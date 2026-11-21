from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Finding, Repository
from app.services.crypto import decrypt_token
from app.services.github import GitHubClient, parse_full_name


def _aegis_checks(db: Session, repository: Repository) -> list[dict]:
    findings = db.scalars(
        select(Finding).where(Finding.repository_id == repository.id)
    ).all()
    categories = {finding.category.lower() for finding in findings}
    critical = sum(1 for finding in findings if finding.severity == "critical")
    checks = [
        {
            "id": "aegis-scan",
            "label": "Aegis code review",
            "status": "pass" if critical == 0 else "fail",
            "detail": f"{len(findings)} findings · {critical} critical",
            "severity": "critical" if critical else "info",
        },
        {
            "id": "secrets",
            "label": "Secret exposure",
            "status": "fail" if "secret" in categories else "pass",
            "detail": "No exposed secrets detected" if "secret" not in categories else "Review secret findings",
            "severity": "high" if "secret" in categories else "info",
        },
        {
            "id": "dependencies",
            "label": "Dependency risk",
            "status": "fail" if "dependency" in categories else "pass",
            "detail": "No vulnerable dependencies detected" if "dependency" not in categories else "Review dependency findings",
            "severity": "high" if "dependency" in categories else "info",
        },
    ]
    return checks


def security_overview(db: Session, repository: Repository) -> dict:
    checks = _aegis_checks(db, repository)
    github: dict = {"connected": False, "login": None, "scope": None}
    try:
        owner, name = parse_full_name(repository.full_name)
    except Exception:
        owner = name = None

    if owner and name:
        try:
            token = decrypt_token(repository.token_encrypted)
            with GitHubClient(token=token, timeout=8.0, max_retries=0) as client:
                remote = client._client.get(f"/repos/{owner}/{name}")
                if remote.status_code < 400:
                    data = remote.json()
                    analysis = data.get("security_and_analysis") or {}
                    github.update(
                        {
                            "connected": True,
                            "login": data.get("full_name"),
                            "private": bool(data.get("private")),
                            "defaultBranch": data.get("default_branch"),
                        }
                    )
                    secret_status = (analysis.get("secret_scanning") or {}).get("status")
                    code_status = (analysis.get("code_scanning") or {}).get("status")
                    checks.append(
                        {
                            "id": "github-secret-scanning",
                            "label": "GitHub secret scanning",
                            "status": "pass" if secret_status == "enabled" else "warn",
                            "detail": secret_status or "Not enabled or unavailable for this repository",
                            "severity": "info" if secret_status == "enabled" else "medium",
                        }
                    )
                    checks.append(
                        {
                            "id": "github-code-scanning",
                            "label": "GitHub code scanning",
                            "status": "pass" if code_status == "enabled" else "warn",
                            "detail": code_status or "Not enabled or unavailable for this repository",
                            "severity": "info" if code_status == "enabled" else "medium",
                        }
                    )
                else:
                    github["error"] = f"GitHub returned {remote.status_code}"
        except Exception as exc:
            github["error"] = str(exc)[:200]
    return {"repository_id": repository.id, "checks": checks, "github": github}
