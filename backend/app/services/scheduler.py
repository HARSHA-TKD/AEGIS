from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import SessionLocal
from app.models import ReportSchedule
from app.services.intel import sync_intel
from app.services.reports import create_report

logger = logging.getLogger(__name__)
_last_intel_sync = 0.0


def run_pending_schedules(db: Session) -> int:
    now = datetime.now(timezone.utc)
    schedules = db.scalars(
        select(ReportSchedule)
        .where(
            ReportSchedule.active.is_(True),
            ReportSchedule.next_run_at <= now,
        )
        .order_by(ReportSchedule.next_run_at.asc())
        .limit(50)
    ).all()
    count = 0
    for schedule in schedules:
        try:
            create_report(
                db,
                user_id=schedule.user_id,
                name=f"{schedule.name} — scheduled",
                scope=schedule.scope,
                kind=schedule.kind,
                repository_id=schedule.repository_id,
            )
            schedule.next_run_at = now + timedelta(hours=schedule.interval_hours)
            db.commit()
            count += 1
        except Exception:
            db.rollback()
            logger.exception("Failed scheduled report %s", schedule.id)
    return count


def run_once() -> None:
    global _last_intel_sync
    with SessionLocal() as db:
        if time.monotonic() - _last_intel_sync >= 86400:
            sync_intel(db)
            _last_intel_sync = time.monotonic()
        run_pending_schedules(db)


async def scheduler_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(run_once)
        except Exception:
            logger.exception("Background scheduler tick failed")
        await asyncio.sleep(60)


async def start_scheduler() -> asyncio.Task | None:
    if not settings.enable_scheduler:
        return None
    return asyncio.create_task(scheduler_loop(), name="aegis-scheduler")
