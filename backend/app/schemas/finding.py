from datetime import datetime
from typing import Literal

from app.schemas.common import CamelModel

FindingStatus = Literal["open", "fixed", "accepted", "false_positive"]


class FindingOut(CamelModel):
    id: str
    scan_id: str
    repository_id: str
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
    status: str
    created_at: datetime


class FindingUpdate(CamelModel):
    status: FindingStatus
