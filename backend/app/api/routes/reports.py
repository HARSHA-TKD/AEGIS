import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models import Report, Repository, User
from app.schemas.report import ReportCreate, ReportOut
from app.services.reports import create_report, render_report

router = APIRouter(prefix="/reports", tags=["reports"])


def _owned_report(db: Session, user: User, report_id: str) -> Report:
    report = db.get(Report, report_id)
    if report is None or report.user_id != user.id:
        raise HTTPException(status_code=404, detail="Report not found.")
    return report


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "aegis-report"


@router.get("", response_model=list[ReportOut])
def list_reports(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[ReportOut]:
    reports = db.scalars(
        select(Report)
        .where(Report.user_id == user.id)
        .order_by(Report.created_at.desc())
    )
    return [ReportOut.model_validate(report) for report in reports]


@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def generate_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReportOut:
    if payload.repository_id:
        repository = db.get(Repository, payload.repository_id)
        if repository is None or repository.user_id != user.id:
            raise HTTPException(status_code=404, detail="Repository not found.")

    report = create_report(
        db,
        user_id=user.id,
        name=payload.name,
        scope=payload.scope,
        kind=payload.kind,
        repository_id=payload.repository_id,
    )
    return ReportOut.model_validate(report)


@router.get("/{report_id}", response_model=ReportOut)
def get_report(
    report_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReportOut:
    return ReportOut.model_validate(_owned_report(db, user, report_id))


@router.get("/{report_id}/download")
def download_report(
    report_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    report = _owned_report(db, user, report_id)
    payload = render_report(report)
    filename = f"{_slug(report.name)}.json"
    return Response(
        content=payload,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    report = _owned_report(db, user, report_id)
    db.delete(report)
    db.commit()
