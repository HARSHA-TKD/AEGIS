from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permission
from app.core.config import settings
from app.db import get_db
from app.models import Finding, Report, Repository, User, Vulnerability
from app.schemas.assistant import (
    AssistantAction,
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantCitation,
    AssistantStatus,
)
from app.services.assistant import AssistantError, generate_reply, provider_status
from app.services.audit import record_audit

router = APIRouter(prefix="/assistant", tags=["assistant"])


def _workspace_snapshot(db: Session, user: User) -> str:
    repo_count = (
        db.scalar(
            select(func.count())
            .select_from(Repository)
            .where(Repository.user_id == user.id)
        )
        or 0
    )

    severity_rows = db.execute(
        select(Finding.severity, func.count())
        .join(Repository, Finding.repository_id == Repository.id)
        .where(Repository.user_id == user.id, Finding.status == "open")
        .group_by(Finding.severity)
    ).all()
    severity = {severity_name: count for severity_name, count in severity_rows}

    top_repos = db.scalars(
        select(Repository)
        .where(Repository.user_id == user.id)
        .order_by(Repository.risk.desc())
        .limit(5)
    ).all()

    report_count = (
        db.scalar(
            select(func.count()).select_from(Report).where(Report.user_id == user.id)
        )
        or 0
    )

    lines = [
        f"- Projects connected: {repo_count}",
        f"- Reports generated: {report_count}",
        "- Open findings: "
        + ", ".join(
            f"{name}={severity.get(name, 0)}"
            for name in ("critical", "high", "medium", "low")
        ),
    ]

    if top_repos:
        lines.append("- Projects by risk:")
        for repo in top_repos:
            lines.append(
                f"  - {repo.full_name} ({repo.language}, branch {repo.branch}): "
                f"risk {repo.risk}/100, findings {repo.critical} critical / "
                f"{repo.high} high / {repo.medium} medium / {repo.low} low"
            )
    else:
        lines.append("- No projects have been connected yet.")

    return "\n".join(lines)


def _tool_context(
    db: Session, user: User, message: str
) -> tuple[list[AssistantAction], list[AssistantCitation]]:
    text = message.lower()
    actions: list[AssistantAction] = []
    citations: list[AssistantCitation] = []

    if any(word in text for word in ("repo", "project", "scan", "risk")):
        rows = db.scalars(
            select(Repository)
            .where(Repository.user_id == user.id)
            .order_by(Repository.risk.desc())
            .limit(3)
        ).all()
        citations.extend(
            AssistantCitation(
                label=row.full_name,
                href=f"/projects/{row.id}",
                snippet=f"Risk {row.risk}/100 · {row.critical} critical · {row.high} high",
            )
            for row in rows
        )
        actions.append(AssistantAction(label="View projects", href="/repositories", tone="primary"))
        actions.append(AssistantAction(label="Scan code", href="/scan"))

    if any(word in text for word in ("finding", "critical", "vulnerability", "issue")):
        rows = db.scalars(
            select(Finding)
            .join(Repository, Finding.repository_id == Repository.id)
            .where(Repository.user_id == user.id, Finding.status == "open")
            .order_by(Finding.created_at.desc())
            .limit(3)
        ).all()
        citations.extend(
            AssistantCitation(
                label=row.title,
                href=f"/projects/{row.repository_id}",
                snippet=f"{row.severity.upper()} · {row.file_path}:{row.line}",
            )
            for row in rows
        )
        actions.append(AssistantAction(label="Review findings", href="/repositories"))

    if "report" in text:
        rows = db.scalars(
            select(Report)
            .where(Report.user_id == user.id)
            .order_by(Report.created_at.desc())
            .limit(3)
        ).all()
        citations.extend(
            AssistantCitation(
                label=row.name,
                href=f"/reports/{row.id}",
                snippet=f"{row.kind} · {row.findings} findings · {row.status}",
            )
            for row in rows
        )
        actions.append(AssistantAction(label="Open reports", href="/reports", tone="primary"))

    if any(word in text for word in ("intel", "cve", "threat")):
        rows = db.scalars(select(Vulnerability).order_by(Vulnerability.epss.desc()).limit(3)).all()
        citations.extend(
            AssistantCitation(
                label=row.cve,
                href=f"/intelligence?vuln={row.id}",
                snippet=f"{row.title} · EPSS {row.epss:.2f}",
            )
            for row in rows
        )
        actions.append(AssistantAction(label="Open alerts", href="/intelligence"))

    deduped: list[AssistantCitation] = []
    seen: set[str] = set()
    for citation in citations:
        key = f"{citation.label}:{citation.href}"
        if key not in seen:
            seen.add(key)
            deduped.append(citation)
    return actions, deduped[:6]


@router.get("/status", response_model=AssistantStatus)
def assistant_status(_: User = Depends(get_current_user)) -> AssistantStatus:
    available, detail = provider_status()
    return AssistantStatus(
        enabled=settings.ai_enabled,
        provider=settings.ai_provider,
        model=settings.ai_model,
        available=available,
        detail=detail,
    )


@router.post("/chat", response_model=AssistantChatResponse)
def assistant_chat(
    payload: AssistantChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("assistant:action")),
) -> AssistantChatResponse:
    history = [{"role": message.role, "content": message.content} for message in payload.messages]
    try:
        result = generate_reply(
            history,
            page=payload.page,
            workspace=_workspace_snapshot(db, user),
        )
    except AssistantError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    actions, citations = _tool_context(db, user, payload.messages[-1].content)
    record_audit(
        db,
        actor=user,
        action="assistant.chat",
        target_type="assistant",
        detail={"page": payload.page or "", "model": result.model},
        request=request,
    )
    return AssistantChatResponse(
        reply=result.reply,
        model=result.model,
        provider=result.provider,
        actions=actions,
        citations=citations,
    )
