from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permission
from app.db import get_db
from app.models import IntelFilter, User, Vulnerability
from app.schemas.intel import IntelFilterCreate, IntelFilterOut, VulnerabilityOut
from app.services.audit import record_audit
from app.services.intel import sync_intel

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
    filter_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[VulnerabilityOut]:
    if filter_id:
        saved = db.get(IntelFilter, filter_id)
        if saved is None or saved.user_id != user.id:
            raise HTTPException(status_code=404, detail="Filter not found.")
        if severity is None:
            severity = saved.severity
        if exploited is None:
            exploited = saved.exploited
        if q is None and saved.query:
            q = saved.query
        sort = saved.sort
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


@router.post("/sync")
def sync_intel_feed(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("settings:write")),
) -> dict:
    created = sync_intel(db)
    record_audit(
        db,
        actor=user,
        action="intel.sync",
        target_type="vulnerability",
        target_id=None,
        detail={"created": created},
        request=request,
    )
    return {"created": created, "status": "ok"}


@router.get("/filters", response_model=list[IntelFilterOut])
def list_filters(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[IntelFilterOut]:
    filters = db.scalars(
        select(IntelFilter)
        .where(IntelFilter.user_id == user.id)
        .order_by(IntelFilter.created_at.desc())
    )
    return [IntelFilterOut.model_validate(item) for item in filters]


@router.post(
    "/filters",
    response_model=IntelFilterOut,
    status_code=status.HTTP_201_CREATED,
)
def create_filter(
    payload: IntelFilterCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> IntelFilterOut:
    saved = IntelFilter(
        user_id=user.id,
        name=payload.name,
        query=payload.query,
        severity=payload.severity,
        exploited=payload.exploited,
        sort=payload.sort,
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return IntelFilterOut.model_validate(saved)


@router.delete("/filters/{filter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_filter(
    filter_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    saved = db.get(IntelFilter, filter_id)
    if saved is None or saved.user_id != user.id:
        raise HTTPException(status_code=404, detail="Filter not found.")
    db.delete(saved)
    db.commit()


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
