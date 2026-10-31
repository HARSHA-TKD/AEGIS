from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models import User, Vulnerability
from app.schemas.intel import VulnerabilityOut

router = APIRouter(prefix="/intel", tags=["intelligence"])

_SORTS = {
    "epss": Vulnerability.epss.desc(),
    "cvss": Vulnerability.cvss.desc(),
    "published": Vulnerability.published.desc(),
    "cve": Vulnerability.cve.asc(),
}


@router.get("", response_model=list[VulnerabilityOut])
def list_intel(
    severity: str | None = Query(default=None),
    exploited: bool | None = Query(default=None),
    q: str | None = Query(default=None),
    sort: str = Query(default="epss", pattern="^(epss|cvss|published|cve)$"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[VulnerabilityOut]:
    stmt = select(Vulnerability).order_by(_SORTS[sort]).limit(limit).offset(offset)
    if severity:
        stmt = stmt.where(Vulnerability.severity == severity)
    if exploited is not None:
        stmt = stmt.where(Vulnerability.exploited == exploited)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Vulnerability.cve.ilike(like),
                Vulnerability.title.ilike(like),
                Vulnerability.package.ilike(like),
                Vulnerability.summary.ilike(like),
            )
        )
    return [VulnerabilityOut.model_validate(item) for item in db.scalars(stmt)]


@router.get("/{identifier}", response_model=VulnerabilityOut)
def get_intel(
    identifier: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> VulnerabilityOut:
    vulnerability = db.scalar(
        select(Vulnerability).where(
            or_(Vulnerability.id == identifier, Vulnerability.cve == identifier.upper())
        )
    )
    if vulnerability is None:
        raise HTTPException(status_code=404, detail="Vulnerability not found.")
    return VulnerabilityOut.model_validate(vulnerability)
