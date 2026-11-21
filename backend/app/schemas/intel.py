from datetime import date, datetime

from pydantic import Field

from app.schemas.common import CamelModel


class VulnerabilityOut(CamelModel):
    id: str
    cve: str
    title: str
    summary: str
    severity: str
    cvss: float
    epss: float
    exploited: bool
    published: date | None
    ecosystem: str
    package: str
    affected: str
    fix_version: str
    tags: list[str]
    cwe: str


class IntelFilterCreate(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    query: str = Field(default="", max_length=255)
    severity: str | None = None
    exploited: bool | None = None
    sort: str = Field(default="epss", pattern="^(epss|cvss|published|cve)$")


class IntelFilterOut(CamelModel):
    id: str
    name: str
    query: str
    severity: str | None
    exploited: bool | None
    sort: str
    created_at: datetime
