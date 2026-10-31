from datetime import datetime

from app.schemas.common import CamelModel


class ScanOut(CamelModel):
    id: str
    repository_id: str
    status: str
    commit_sha: str | None
    files_scanned: int
    loc: int
    risk: int
    findings_total: int
    critical: int
    high: int
    medium: int
    low: int
    error: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class AnalyzeRequest(CamelModel):
    code: str
    file_path: str = "snippet"


class ScannerFinding(CamelModel):
    rule_id: str
    title: str
    severity: str
    category: str
    cwe: str
    file_path: str
    line: int
    snippet: str
    description: str
    impact: str
    fix: str
    confidence: int
    tags: list[str]


class GradeOut(CamelModel):
    grade: str
    label: str
    tone: str


class AnalyzeResponse(CamelModel):
    findings: list[ScannerFinding]
    risk: int
    grade: GradeOut
