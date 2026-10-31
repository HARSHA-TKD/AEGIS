from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class RepoConnect(CamelModel):
    full_name: str = Field(
        min_length=3,
        max_length=255,
        description="GitHub repository in owner/name form.",
        examples=["northwind/payments-api"],
    )
    branch: str | None = Field(default=None, max_length=255)
    token: str | None = Field(
        default=None,
        description="Optional GitHub PAT used for private repositories. Stored encrypted.",
    )


class RepoUpdate(CamelModel):
    branch: str | None = Field(default=None, max_length=255)
    token: str | None = None


class RepoOut(CamelModel):
    id: str
    provider: str
    full_name: str
    name: str
    org: str
    language: str
    branch: str
    risk: int
    critical: int
    high: int
    medium: int
    low: int
    loc: int
    files: int
    status: str
    last_scan_at: datetime | None
    created_at: datetime
