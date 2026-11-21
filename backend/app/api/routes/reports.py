import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permission
from app.db import get_db
from app.models import Report, ReportSchedule, Repository, User
from app.schemas.report import (
    ReportCreate,
    ReportOut,
    ReportScheduleCreate,
    ReportScheduleOut,
    ReportTrendPoint,
)
from app.services.audit import record_audit
from app.services.reports import (
    create_report,
    render_report,
    render_report_export,
    report_trends,
)

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
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("report:write")),
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
    record_audit(
        db,
        actor=user,
        action="report.create",
        target_type="report",
        target_id=report.id,
        detail={"name": report.name, "kind": report.kind, "scope": report.scope},
        request=request,
    )
    return ReportOut.model_validate(report)


def _owned_schedule(db: Session, user: User, schedule_id: str) -> ReportSchedule:
    schedule = db.get(ReportSchedule, schedule_id)
    if schedule is None or schedule.user_id != user.id:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return schedule


@router.get("/trends", response_model=list[ReportTrendPoint])
def get_report_trends(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ReportTrendPoint]:
    return [ReportTrendPoint.model_validate(item) for item in report_trends(db, user.id)]


@router.get("/schedules", response_model=list[ReportScheduleOut])
def list_schedules(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ReportScheduleOut]:
    schedules = db.scalars(
        select(ReportSchedule)
        .where(ReportSchedule.user_id == user.id)
        .order_by(ReportSchedule.created_at.desc())
    )
    return [ReportScheduleOut.model_validate(item) for item in schedules]


@router.post(
    "/schedules",
    response_model=ReportScheduleOut,
    status_code=status.HTTP_201_CREATED,
)
def create_schedule(
    payload: ReportScheduleCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("report:write")),
) -> ReportScheduleOut:
    if payload.repository_id:
        repository = db.get(Repository, payload.repository_id)
        if repository is None or repository.user_id != user.id:
            raise HTTPException(status_code=404, detail="Repository not found.")
    schedule = ReportSchedule(
        user_id=user.id,
        name=payload.name,
        scope=payload.scope,
        kind=payload.kind,
        repository_id=payload.repository_id,
        interval_hours=payload.interval_hours,
        next_run_at=datetime.now(timezone.utc)
        + timedelta(hours=payload.interval_hours),
        active=True,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    record_audit(
        db,
        actor=user,
        action="report.schedule",
        target_type="report_schedule",
        target_id=schedule.id,
        detail={"name": schedule.name, "intervalHours": schedule.interval_hours},
        request=request,
    )
    return ReportScheduleOut.model_validate(schedule)


@router.patch("/schedules/{schedule_id}", response_model=ReportScheduleOut)
def toggle_schedule(
    schedule_id: str,
    active: bool = Query(default=True),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("report:write")),
) -> ReportScheduleOut:
    schedule = _owned_schedule(db, user, schedule_id)
    schedule.active = active
    db.commit()
    db.refresh(schedule)
    return ReportScheduleOut.model_validate(schedule)


@router.delete("/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("report:write")),
) -> None:
    schedule = _owned_schedule(db, user, schedule_id)
    db.delete(schedule)
    db.commit()


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


@router.get("/{report_id}/export")
def export_report(
    report_id: str,
    format: str = Query(default="csv", pattern="^(csv|html)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    report = _owned_report(db, user, report_id)
    payload, media_type, extension = render_report_export(report, format)
    filename = f"{_slug(report.name)}.{extension}"
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("report:write")),
) -> None:
    report = _owned_report(db, user, report_id)
    db.delete(report)
    db.commit()
    record_audit(
        db,
        actor=user,
        action="report.delete",
        target_type="report",
        target_id=report.id,
        detail={"name": report.name},
        request=request,
    )
