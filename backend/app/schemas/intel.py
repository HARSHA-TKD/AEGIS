from datetime import date

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
