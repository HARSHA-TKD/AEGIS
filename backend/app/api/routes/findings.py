from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models import Finding, Repository, User
from app.schemas.finding import FindingOut, FindingUpdate

router = APIRouter(prefix="/findings", tags=["findings"])

_SEVERITY_ORDER = case(
    (Finding.severity == "critical", 0),
    (Finding.severity == "high", 1),
    (Finding.severity == "medium", 2),
    (Finding.severity == "low", 3),
    else_=4,
)


@router.get("", response_model=list[FindingOut])
def list_findings(
    repository_id: str | None = Query(default=None, alias="repositoryId"),
    scan_id: str | None = Query(default=None, alias="scanId"),
    severity: str | None = Query(default=None),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Free-text match on title, path or snippet."),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(Finding)
        .join(Repository, Finding.repository_id == Repository.id)
        .where(Repository.user_id == user.id)
        .order_by(_SEVERITY_ORDER, Finding.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if repository_id:
        stmt = stmt.where(Finding.repository_id == repository_id)
    if scan_id:
        stmt = stmt.where(Finding.scan_id == scan_id)
    if severity:
        stmt = stmt.where(Finding.severity == severity)
    if status:
        stmt = stmt.where(Finding.status == status)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Finding.title.ilike(like),
                Finding.file_path.ilike(like),
                Finding.snippet.ilike(like),
                Finding.cwe.ilike(like),
            )
        )
    return [FindingOut.model_validate(finding) for finding in db.scalars(stmt)]


def _owned_finding(db: Session, user: User, finding_id: str) -> Finding:
    finding = db.scalar(
        select(Finding)
        .join(Repository, Finding.repository_id == Repository.id)
        .where(Finding.id == finding_id, Repository.user_id == user.id)
    )
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found.")
    return finding


@router.get("/{finding_id}", response_model=FindingOut)
def get_finding(
    finding_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FindingOut:
    return FindingOut.model_validate(_owned_finding(db, user, finding_id))


@router.patch("/{finding_id}", response_model=FindingOut)
def update_finding(
    finding_id: str,
    payload: FindingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FindingOut:
    finding = _owned_finding(db, user, finding_id)
    finding.status = payload.status
    db.commit()
    db.refresh(finding)
    return FindingOut.model_validate(finding)
