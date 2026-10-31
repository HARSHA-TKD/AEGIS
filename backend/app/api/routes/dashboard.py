from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models import FeedEvent, Finding, Repository, Scan, User
from app.schemas.dashboard import (
    DashboardOut,
    DashboardStats,
    FeedItemOut,
    RadarPoint,
    SeveritySlice,
    TrendPoint,
)
from app.schemas.repo import RepoOut
from app.schemas.scan import ScanOut
from app.services.scanner import SEVERITY_WEIGHT

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

SEVERITY_COLORS = {
    "Critical": "#ff7a8a",
    "High": "#ffb86b",
    "Medium": "#8b9dff",
    "Low": "#5eead4",
}

RADAR_CATEGORIES = {
    "Injection": {"Injection", "Cross-Site Scripting", "Deserialisation"},
    "Secrets": {"Secrets"},
    "Crypto": {"Cryptography"},
    "Auth": {"Authentication", "Authorization"},
    "Deps": {"Dependencies", "Supply Chain"},
    "Config": {"Configuration", "Transport"},
}


def _month_label(value: datetime) -> str:
    return value.strftime("%b")


@router.get("", response_model=DashboardOut)
def get_dashboard(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> DashboardOut:
    repositories = list(
        db.scalars(
            select(Repository)
            .where(Repository.user_id == user.id)
            .order_by(Repository.risk.desc())
        )
    )

    repo_ids = [repo.id for repo in repositories]
    findings: list[Finding] = []
    scans: list[Scan] = []
    if repo_ids:
        findings = list(
            db.scalars(
                select(Finding)
                .where(Finding.repository_id.in_(repo_ids))
                .where(Finding.status == "open")
            )
        )
        scans = list(
            db.scalars(
                select(Scan)
                .where(Scan.repository_id.in_(repo_ids))
                .order_by(Scan.created_at.desc())
            )
        )

    severity_counts: dict[str, int] = defaultdict(int)
    for finding in findings:
        severity_counts[finding.severity.lower()] += 1

    critical = severity_counts["critical"]
    high = severity_counts["high"]
    average_risk = round(sum(repo.risk for repo in repositories) / len(repositories)) if repositories else 0

    stats = DashboardStats(
        repositories=len(repositories),
        at_risk=sum(1 for repo in repositories if repo.risk > 40),
        critical=critical,
        high=high,
        open_findings=len(findings),
        scans=len(scans),
        average_risk=average_risk,
    )

    severity_mix = [
        SeveritySlice(label="Critical", value=critical, color=SEVERITY_COLORS["Critical"]),
        SeveritySlice(label="High", value=high, color=SEVERITY_COLORS["High"]),
        SeveritySlice(
            label="Medium",
            value=severity_counts["medium"],
            color=SEVERITY_COLORS["Medium"],
        ),
        SeveritySlice(
            label="Low",
            value=severity_counts["low"],
            color=SEVERITY_COLORS["Low"],
        ),
    ]

    trend_buckets: dict[str, list[int]] = defaultdict(list)
    for scan in scans:
        if scan.status != "complete" or scan.completed_at is None:
            continue
        key = scan.completed_at.strftime("%Y-%m")
        trend_buckets[key].append(scan.risk)
    risk_trend = [
        TrendPoint(label=_month_label(datetime.strptime(key, "%Y-%m")), value=round(sum(values) / len(values)))
        for key, values in sorted(trend_buckets.items())[-10:]
    ]
    if not risk_trend and repositories:
        risk_trend = [TrendPoint(label=datetime.now().strftime("%b"), value=average_risk)]

    weighted: dict[str, float] = defaultdict(float)
    for finding in findings:
        weighted[finding.category] += SEVERITY_WEIGHT.get(finding.severity, 0) * (
            finding.confidence / 100
        )
    denominator = max(1, len(repositories) * 6)
    radar = [
        RadarPoint(
            label=label,
            value=min(
                100,
                round(
                    sum(weighted[category] for category in categories)
                    / denominator
                    * 100
                ),
            ),
        )
        for label, categories in RADAR_CATEGORIES.items()
    ]

    feed = list(
        db.scalars(
            select(FeedEvent)
            .where(FeedEvent.user_id == user.id)
            .order_by(FeedEvent.created_at.desc())
            .limit(12)
        )
    )

    recent_scans = list(
        db.scalars(
            select(Scan)
            .join(Repository, Scan.repository_id == Repository.id)
            .where(Repository.user_id == user.id)
            .order_by(Scan.created_at.desc())
            .limit(5)
        )
    )

    return DashboardOut(
        stats=stats,
        severity_mix=severity_mix,
        risk_trend=risk_trend,
        radar=radar,
        feed=[FeedItemOut.model_validate(item) for item in feed],
        top_repos=[RepoOut.model_validate(repo) for repo in repositories[:4]],
        recent_scans=[ScanOut.model_validate(scan) for scan in recent_scans],
    )
