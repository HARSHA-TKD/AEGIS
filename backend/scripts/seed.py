"""Seed Aegis with the demo dataset used by the frontend.

Run from the backend directory:

    .venv/bin/python -m scripts.seed
    .venv/bin/python -m scripts.seed --reset

The demo credentials are operator@aegis.dev / aegis-demo-2026.
"""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timedelta, timezone
from itertools import cycle
from pathlib import Path

from sqlalchemy import delete, select

from app.core.security import hash_password
from app.db import SessionLocal, utcnow
from app.models import (
    FeedEvent,
    Finding,
    Report,
    Repository,
    Scan,
    User,
    Vulnerability,
)
from app.services.reports import build_summary
from app.services.scanner import RULES, SEVERITY_WEIGHT

DEMO_EMAIL = "operator@aegis.dev"
DEMO_PASSWORD = "aegis-demo-2026"
DEMO_NAME = "Avery Chen"

DATA_FILE = Path(__file__).resolve().parents[1] / "seed" / "frontend-data.json"

RULE_SNIPPETS = {
    "rce-eval": 'eval(req.query.expression);',
    "cmd-exec": 'exec("ping -c 1 " + req.query.host);',
    "cmd-shell-true": 'subprocess.run(command, shell=True)',
    "sqli-concat": 'const query = "SELECT * FROM users WHERE id = " + req.query.id;',
    "xss-innerhtml": 'document.getElementById("profile").innerHTML = rows[0].bio;',
    "xss-dangerous": "<div dangerouslySetInnerHTML={{ __html: comment.body }} />",
    "hardcoded-secret": 'const STRIPE_KEY = "sk_test_demo_replaced";',
    "weak-hash": 'crypto.createHash("md5").update(token).digest("hex");',
    "insecure-random": "const resetToken = Math.random().toString(36).slice(2);",
    "tls-verify-off": "https.request(url, { rejectUnauthorized: false });",
    "unsafe-deser": "payload = pickle.loads(request.data)",
    "ssti": 'render_template_string("Hello " + request.args["name"])',
    "cors-wildcard": 'res.setHeader("Access-Control-Allow-Origin", "*");',
    "cleartext-http": 'fetch("http://internal.api/health");',
    "debug-true": "app.run(debug=True)",
}

RULES_BY_SEVERITY: dict[str, list] = {}
for rule in RULES:
    RULES_BY_SEVERITY.setdefault(rule.severity, []).append(rule)


def _relative_time(label: str) -> datetime | None:
    now = utcnow()
    label = (label or "").strip().lower()
    if not label or label == "scanning":
        return None
    number, _, unit = label.partition(" ")
    try:
        value = int(number)
    except ValueError:
        return None
    unit = unit.rstrip("s")
    if unit == "min":
        delta = timedelta(minutes=value)
    elif unit in {"hr", "hour"}:
        delta = timedelta(hours=value)
    elif unit == "day":
        delta = timedelta(days=value)
    else:
        return None
    return now - delta


def _parse_loc(value: str) -> int:
    value = (value or "0").strip().lower().replace(",", "")
    if value.endswith("k"):
        return int(float(value[:-1]) * 1000)
    if value.endswith("m"):
        return int(float(value[:-1]) * 1_000_000)
    try:
        return int(float(value))
    except ValueError:
        return 0


def _load() -> dict:
    with DATA_FILE.open(encoding="utf-8") as handle:
        return json.load(handle)


def _clear(db, user: User | None) -> None:
    db.execute(delete(Vulnerability))
    if user is not None:
        db.execute(delete(FeedEvent).where(FeedEvent.user_id == user.id))
        db.execute(delete(Report).where(Report.user_id == user.id))
        db.execute(delete(Repository).where(Repository.user_id == user.id))
        db.delete(user)
    db.commit()


def _make_findings(repo: Repository, scan: Scan, counts: dict[str, int]) -> list[Finding]:
    findings: list[Finding] = []
    statuses = cycle(["open", "open", "open", "fixed", "open", "accepted", "open", "false_positive"])
    index = 0
    for severity in ("critical", "high", "medium", "low"):
        pool = RULES_BY_SEVERITY.get(severity, [])
        if not pool:
            continue
        for offset in range(counts.get(severity, 0)):
            rule = pool[offset % len(pool)]
            index += 1
            findings.append(
                Finding(
                    scan_id=scan.id,
                    repository_id=repo.id,
                    rule_id=f"{rule.id}-{index}",
                    title=rule.title,
                    severity=rule.severity,
                    category=rule.category,
                    cwe=rule.cwe,
                    file_path=f"src/modules/module-{index:02d}.ts",
                    line=12 + (index * 7) % 180,
                    snippet=RULE_SNIPPETS.get(rule.id, rule.title),
                    description=rule.description,
                    impact=rule.impact,
                    fix=rule.fix,
                    confidence=rule.confidence,
                    tags=list(rule.tags),
                    status=next(statuses),
                )
            )
    return findings


def _trend_scans(db, repo: Repository, trend: list[dict], now: datetime) -> None:
    month_numbers = {
        "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
        "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
    }
    for index, point in enumerate(trend):
        month = month_numbers.get(str(point.get("label", "")), now.month)
        year = now.year if month <= now.month else now.year - 1
        completed = datetime(year, month, 28, 12, tzinfo=timezone.utc)
        scan = Scan(
            id=f"scan-trend-{repo.id}-{index}",
            repository_id=repo.id,
            status="complete",
            commit_sha=None,
            files_scanned=repo.files,
            loc=repo.loc,
            risk=int(point["value"]),
            findings_total=0,
            critical=0,
            high=0,
            medium=0,
            low=0,
            started_at=completed - timedelta(minutes=4),
            completed_at=completed,
        )
        db.add(scan)


def seed(reset: bool) -> None:
    data = _load()
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if existing is not None and not reset:
            print("Demo data already present. Re-run with --reset to rebuild it.")
            return
        _clear(db, existing)

        user = User(
            name=DEMO_NAME,
            email=DEMO_EMAIL,
            password_hash=hash_password(DEMO_PASSWORD),
            role="owner",
        )
        db.add(user)
        db.flush()

        for item in data["vulnerabilities"]:
            published = None
            if item.get("published"):
                try:
                    published = date.fromisoformat(item["published"])
                except ValueError:
                    published = None
            db.add(
                Vulnerability(
                    id=item["id"],
                    cve=item["cve"],
                    title=item["title"],
                    summary=item["summary"],
                    severity=item["severity"],
                    cvss=float(item["cvss"]),
                    epss=float(item["epss"]),
                    exploited=bool(item["exploited"]),
                    published=published,
                    ecosystem=item["ecosystem"],
                    package=item["package"],
                    affected=item["affected"],
                    fix_version=item["fixVersion"],
                    tags=list(item["tags"]),
                    cwe=item["cwe"],
                )
            )

        now = utcnow()
        repositories: list[Repository] = []
        for item in data["repos"]:
            last_scan_at = _relative_time(item["lastScan"])
            repo = Repository(
                id=item["id"],
                user_id=user.id,
                provider="github",
                full_name=f"{item['org']}/{item['name']}",
                name=item["name"],
                org=item["org"],
                language=item["language"],
                branch=item["branch"],
                risk=item["risk"],
                critical=item["critical"],
                high=item["high"],
                medium=item["medium"],
                low=item["low"],
                loc=_parse_loc(item["loc"]),
                files=max(1, _parse_loc(item["loc"]) // 320),
                status=item["status"],
                last_scan_at=last_scan_at,
            )
            db.add(repo)
            repositories.append(repo)
        db.flush()

        for repo in repositories:
            counts = {
                "critical": repo.critical,
                "high": repo.high,
                "medium": repo.medium,
                "low": repo.low,
            }
            if repo.status == "scanning":
                scan = Scan(
                    id=f"scan-{repo.id}-current",
                    repository_id=repo.id,
                    status="running",
                    started_at=now - timedelta(minutes=2),
                    files_scanned=0,
                    loc=0,
                )
                db.add(scan)
                repo.last_scan_id = scan.id
                continue

            completed_at = repo.last_scan_at or now
            scan = Scan(
                id=f"scan-{repo.id}-current",
                repository_id=repo.id,
                status="complete",
                commit_sha=f"demo{repo.id}{repo.branch}".replace("/", "")[:40],
                files_scanned=repo.files,
                loc=repo.loc,
                risk=repo.risk,
                findings_total=sum(counts.values()),
                critical=counts["critical"],
                high=counts["high"],
                medium=counts["medium"],
                low=counts["low"],
                started_at=completed_at - timedelta(minutes=3),
                completed_at=completed_at,
            )
            db.add(scan)
            db.flush()
            repo.last_scan_id = scan.id
            for finding in _make_findings(repo, scan, counts):
                db.add(finding)

        # Historical scans so the risk trend chart has a full series.
        trend_repo = next((repo for repo in repositories if repo.name == "payments-api"), repositories[0])
        _trend_scans(db, trend_repo, data.get("riskTrend", []), now)

        db.flush()

        for offset, item in enumerate(data["reports"]):
            created = now - timedelta(days=2 + offset * 6)
            summary, size_bytes, findings_count, critical = build_summary(
                db,
                user_id=user.id,
                name=item["name"],
                scope=item["scope"],
                kind="custom",
                repository_id=None,
            )
            report = Report(
                id=item["id"],
                user_id=user.id,
                name=item["name"],
                scope=item["scope"],
                kind="custom",
                status="ready",
                findings=findings_count,
                critical=critical,
                size_bytes=size_bytes,
                summary=summary,
                created_at=created,
                updated_at=created,
                generated_at=created,
            )
            db.add(report)

        offsets = {
            "f1": 2,
            "f2": 9,
            "f3": 17,
            "f4": 34,
            "f5": 41,
            "f6": 60,
        }
        for item in data["dashboardFeed"]:
            minutes = offsets.get(item["id"], 0)
            db.add(
                FeedEvent(
                    id=item["id"],
                    user_id=user.id,
                    kind=item["kind"],
                    title=item["title"],
                    detail=item["detail"],
                    created_at=now - timedelta(minutes=minutes),
                )
            )

        db.commit()
        print(
            f"Seeded {len(repositories)} repositories, {len(data['vulnerabilities'])} "
            f"vulnerabilities and {len(data['reports'])} reports."
        )
        print(f"Sign in with {DEMO_EMAIL} / {DEMO_PASSWORD}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the Aegis database.")
    parser.add_argument("--reset", action="store_true", help="Delete and rebuild demo data.")
    args = parser.parse_args()
    seed(reset=args.reset)


if __name__ == "__main__":
    main()
