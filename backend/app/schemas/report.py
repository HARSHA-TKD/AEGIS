from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

ReportKind = Literal["posture", "compliance", "deep_review", "dependency", "custom"]


class ReportCreate(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    scope: str = Field(default="All repositories", max_length=255)
    kind: ReportKind = "custom"
    repository_id: str | None = None


class ReportOut(CamelModel):
    id: str
    name: str
    scope: str
    kind: str
    status: str
    findings: int
    critical: int
    size_bytes: int
    created_at: datetime
    generated_at: datetime | None
