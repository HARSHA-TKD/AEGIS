from datetime import datetime

from app.schemas.common import CamelModel
from app.schemas.repo import RepoOut
from app.schemas.scan import ScanOut


class FeedItemOut(CamelModel):
    id: str
    kind: str
    title: str
    detail: str
    created_at: datetime


class SeveritySlice(CamelModel):
    label: str
    value: int
    color: str


class TrendPoint(CamelModel):
    label: str
    value: int


class RadarPoint(CamelModel):
    label: str
    value: int


class DashboardStats(CamelModel):
    repositories: int
    at_risk: int
    critical: int
    high: int
    open_findings: int
    scans: int
    average_risk: int


class DashboardOut(CamelModel):
    stats: DashboardStats
    severity_mix: list[SeveritySlice]
    risk_trend: list[TrendPoint]
    radar: list[RadarPoint]
    feed: list[FeedItemOut]
    top_repos: list[RepoOut]
    recent_scans: list[ScanOut]
