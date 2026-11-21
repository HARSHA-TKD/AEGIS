"""Report materialisation.

Reports are stored as a JSON summary so the download endpoint does not need
to re-query the database and historical reports remain stable.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from html import escape

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import utcnow
from app.models import Finding, Report, Repository, Scan
from app.services.scanner import SEVERITY_WEIGHT


def _repositories(db: Session, user_id: str, repository_id: str | None) -> list[Repository]:
    stmt = select(Repository).where(Repository.user_id == user_id)
    if repository_id:
        stmt = stmt.where(Repository.id == repository_id)
    return list(db.scalars(stmt.order_by(Repository.risk.desc())))


def build_summary(
    db: Session,
    user_id: str,
    name: str,
    scope: str,
    kind: str,
    repository_id: str | None,
) -> tuple[dict, int, int, int]:
    repositories = _repositories(db, user_id, repository_id)
    repo_ids = [repo.id for repo in repositories]
    generated_at = utcnow()

    findings: list[Finding] = []
    if repo_ids:
        findings = list(
            db.scalars(
                select(Finding)
                .where(Finding.repository_id.in_(repo_ids))
                .where(Finding.status != "false_positive")
                .order_by(Finding.created_at.desc())
            )
        )

    severity = Counter(finding.severity for finding in findings)
    categories = Counter(finding.category for finding in findings)
    repo_by_id = {repo.id: repo for repo in repositories}

    findings.sort(key=lambda item: SEVERITY_WEIGHT.get(item.severity, 0), reverse=True)

    summary = {
        "report": {
            "name": name,
            "scope": scope,
            "kind": kind,
            "generatedAt": generated_at.isoformat(),
        },
        "totals": {
            "repositories": len(repositories),
            "findings": len(findings),
            "critical": severity.get("critical", 0),
            "high": severity.get("high", 0),
            "medium": severity.get("medium", 0),
            "low": severity.get("low", 0),
        },
        "severity": {
            "critical": severity.get("critical", 0),
            "high": severity.get("high", 0),
            "medium": severity.get("medium", 0),
            "low": severity.get("low", 0),
            "info": severity.get("info", 0),
        },
        "categories": [
            {"category": category, "count": count}
            for category, count in categories.most_common()
        ],
        "repositories": [
            {
                "id": repo.id,
                "fullName": repo.full_name,
                "language": repo.language,
                "branch": repo.branch,
                "risk": repo.risk,
                "critical": repo.critical,
                "high": repo.high,
                "medium": repo.medium,
                "low": repo.low,
                "lastScanAt": repo.last_scan_at.isoformat() if repo.last_scan_at else None,
            }
            for repo in repositories
        ],
        "findings": [
            {
                "id": finding.id,
                "title": finding.title,
                "severity": finding.severity,
                "category": finding.category,
                "cwe": finding.cwe,
                "repository": repo_by_id[finding.repository_id].full_name
                if finding.repository_id in repo_by_id
                else "",
                "filePath": finding.file_path,
                "line": finding.line,
                "confidence": finding.confidence,
            }
            for finding in findings[:500]
        ],
    }

    size_bytes = len(_serialise(summary))
    return summary, size_bytes, len(findings), severity.get("critical", 0)


def _serialise(summary: dict) -> bytes:
    import json

    return json.dumps(summary, indent=2, default=str).encode("utf-8")


def render_report(report: Report) -> bytes:
    return _serialise(report.summary)


def create_report(
    db: Session,
    *,
    user_id: str,
    name: str,
    scope: str,
    kind: str,
    repository_id: str | None,
) -> Report:
    summary, size_bytes, findings, critical = build_summary(
        db, user_id, name, scope, kind, repository_id
    )
    report = Report(
        user_id=user_id,
        name=name,
        scope=scope,
        kind=kind,
        status="ready",
        findings=findings,
        critical=critical,
        size_bytes=size_bytes,
        summary=summary,
        generated_at=datetime.now(timezone.utc),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def render_report_export(report: Report, export_format: str) -> tuple[bytes, str, str]:
    summary = report.summary or {}
    if export_format == "csv":
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["title", "severity", "category", "repository", "file", "line", "confidence"])
        for item in summary.get("findings", []):
            writer.writerow(
                [
                    item.get("title", ""),
                    item.get("severity", ""),
                    item.get("category", ""),
                    item.get("repository", ""),
                    item.get("filePath", ""),
                    item.get("line", ""),
                    item.get("confidence", ""),
                ]
            )
        return output.getvalue().encode("utf-8"), "text/csv", "csv"

    totals = summary.get("totals", {})
    rows = "".join(
        f"<tr><td>{escape(str(item.get('title', '')))}</td><td>{escape(str(item.get('severity', '')))}</td><td>{escape(str(item.get('filePath', '')))}:{item.get('line', '')}</td></tr>"
        for item in summary.get("findings", [])
    )
    html = f"""<!doctype html><html><head><meta charset="utf-8"><title>{escape(report.name)}</title>
<style>body{{font-family:system-ui,sans-serif;margin:40px;color:#2a241c;background:#faf5ec}}h1{{font-size:28px}}table{{border-collapse:collapse;width:100%;margin-top:24px}}th,td{{border:1px solid #ded2bf;padding:8px;text-align:left;font-size:13px}}th{{background:#ece2d2}}</style></head>
<body><h1>{escape(report.name)}</h1><p>{escape(report.scope)} · {escape(report.kind)}</p><p>{totals.get('findings', 0)} findings · {totals.get('critical', 0)} critical · {totals.get('high', 0)} high</p><table><thead><tr><th>Finding</th><th>Severity</th><th>Location</th></tr></thead><tbody>{rows}</tbody></table></body></html>"""
    return html.encode("utf-8"), "text/html", "html"


def report_trends(db: Session, user_id: str) -> list[dict]:
    rows = db.execute(
        select(Scan.completed_at, Scan.risk, Scan.findings_total)
        .join(Repository, Scan.repository_id == Repository.id)
        .where(Repository.user_id == user_id, Scan.status == "complete", Scan.completed_at.is_not(None))
        .order_by(Scan.completed_at.asc())
    ).all()
    return [
        {
            "completedAt": completed_at,
            "risk": risk,
            "findings": findings_total,
        }
        for completed_at, risk, findings_total in rows[-24:]
    ]
