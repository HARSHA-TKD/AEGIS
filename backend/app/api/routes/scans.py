from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models import Repository, Scan, User
from app.schemas.finding import FindingOut
from app.schemas.scan import (
    AnalyzeRequest,
    AnalyzeResponse,
    GradeOut,
    ScanOut,
    ScannerFinding,
)
from app.services.scanner import analyze_code, grade_for, risk_score

router = APIRouter(prefix="/scans", tags=["scans"])


def _owned_scan(db: Session, user: User, scan_id: str) -> Scan:
    scan = db.scalar(
        select(Scan)
        .join(Repository, Scan.repository_id == Repository.id)
        .where(Scan.id == scan_id, Repository.user_id == user.id)
    )
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return scan


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_snippet(
    payload: AnalyzeRequest,
    _: User = Depends(get_current_user),
) -> AnalyzeResponse:
    results = analyze_code(payload.code, payload.file_path or "snippet")
    score = risk_score(results)
    return AnalyzeResponse(
        findings=[ScannerFinding.model_validate(item.as_dict()) for item in results],
        risk=score,
        grade=GradeOut(**grade_for(score)),
    )


@router.get("", response_model=list[ScanOut])
def list_scans(
    repository_id: str | None = Query(default=None, alias="repositoryId"),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Scan]:
    stmt = (
        select(Scan)
        .join(Repository, Scan.repository_id == Repository.id)
        .where(Repository.user_id == user.id)
        .order_by(Scan.created_at.desc())
        .limit(limit)
    )
    if repository_id:
        stmt = stmt.where(Scan.repository_id == repository_id)
    return list(db.scalars(stmt))


@router.get("/{scan_id}", response_model=ScanOut)
def get_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Scan:
    return _owned_scan(db, user, scan_id)


@router.get("/{scan_id}/findings", response_model=list[FindingOut])
def scan_findings(
    scan_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[FindingOut]:
    scan = _owned_scan(db, user, scan_id)
    return [FindingOut.model_validate(finding) for finding in scan.findings]
