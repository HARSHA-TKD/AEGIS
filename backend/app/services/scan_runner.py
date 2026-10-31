"""Background scan orchestration.

A scan is queued by the API and executed after the response is sent. The
runner owns its own database session because the request-scoped session is
closed once the response returns.
"""

from __future__ import annotations

import logging

from app.db import SessionLocal, utcnow
from app.models import FeedEvent, Finding, Repository, Scan
from app.services.crypto import decrypt_token
from app.services.github import GitHubClient, GitHubError
from app.services.scanner import analyze_files, risk_score

logger = logging.getLogger(__name__)


def _severity_counts(findings: list[dict]) -> dict[str, int]:
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for finding in findings:
        counts[finding["severity"]] = counts.get(finding["severity"], 0) + 1
    return counts


def run_scan(scan_id: str) -> None:
    db = SessionLocal()
    try:
        scan = db.get(Scan, scan_id)
        if scan is None:
            logger.warning("scan %s no longer exists", scan_id)
            return

        repository = db.get(Repository, scan.repository_id)
        if repository is None:
            scan.status = "failed"
            scan.error = "Repository was removed before the scan started."
            db.commit()
            return

        scan.status = "running"
        scan.started_at = utcnow()
        repository.status = "scanning"
        db.commit()

        token = decrypt_token(repository.token_encrypted)
        try:
            with GitHubClient(token=token) as client:
                bundle = client.collect_source(repository.full_name, repository.branch)
        except GitHubError as exc:
            _fail(db, scan, repository, exc.message)
            return
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("unexpected scan failure")
            _fail(db, scan, repository, f"Unexpected scan error: {exc}")
            return

        results = analyze_files(bundle.files)
        payload = [finding.as_dict() for finding in results]
        counts = _severity_counts(payload)
        score = risk_score(results)

        db.query(Finding).filter(Finding.scan_id == scan.id).delete()

        for finding in payload:
            db.add(
                Finding(
                    scan_id=scan.id,
                    repository_id=repository.id,
                    rule_id=finding["rule_id"],
                    title=finding["title"],
                    severity=finding["severity"],
                    category=finding["category"],
                    cwe=finding["cwe"],
                    file_path=finding["file_path"],
                    line=finding["line"],
                    snippet=finding["snippet"],
                    description=finding["description"],
                    impact=finding["impact"],
                    fix=finding["fix"],
                    confidence=finding["confidence"],
                    tags=finding["tags"],
                    status="open",
                )
            )

        scan.status = "complete"
        scan.commit_sha = bundle.commit_sha
        scan.files_scanned = len(bundle.files)
        scan.loc = bundle.loc
        scan.risk = score
        scan.findings_total = len(payload)
        scan.critical = counts["critical"]
        scan.high = counts["high"]
        scan.medium = counts["medium"]
        scan.low = counts["low"]
        scan.completed_at = utcnow()
        scan.error = None

        repository.language = bundle.language
        repository.loc = bundle.loc
        repository.files = len(bundle.files)
        repository.risk = score
        repository.critical = counts["critical"]
        repository.high = counts["high"]
        repository.medium = counts["medium"]
        repository.low = counts["low"]
        repository.status = "at-risk" if score > 40 else "protected"
        repository.last_scan_at = scan.completed_at
        repository.last_scan_id = scan.id

        db.add(
            FeedEvent(
                user_id=repository.user_id,
                repository_id=repository.id,
                kind="scan",
                title="Deep review completed" if payload else "Baseline scan completed",
                detail=(
                    f"{repository.full_name} · {bundle.loc:,} LOC · "
                    f"{counts['critical']} critical · risk {score}/100"
                ),
            )
        )

        if counts["critical"]:
            db.add(
                FeedEvent(
                    user_id=repository.user_id,
                    repository_id=repository.id,
                    kind="alert",
                    title="Critical findings require review",
                    detail=(
                        f"{repository.full_name} · {counts['critical']} critical, "
                        f"{counts['high']} high"
                    ),
                )
            )

        db.commit()
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("scan %s crashed", scan_id)
        db.rollback()
        scan = db.get(Scan, scan_id)
        if scan is not None:
            _fail(db, scan, scan.repository, f"Unexpected scan error: {exc}")
    finally:
        db.close()


def _fail(db, scan: Scan, repository: Repository, message: str) -> None:
    scan.status = "failed"
    scan.error = message
    scan.completed_at = utcnow()
    if repository.status == "scanning":
        repository.status = "at-risk" if repository.risk > 40 else "protected"
    db.commit()
