from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.config import settings
from app.core.request_context import get_request_id
from app.db import get_db
from app.services.assistant import provider_status

router = APIRouter(prefix="/health", tags=["system"])


@router.get("", response_model=dict)
def health(
    db: Session = Depends(get_db),
    _ = Depends(require_permission("health:read")),
) -> dict:
    try:
        db.execute(text("SELECT 1"))
        database = {"status": "ok"}
    except Exception as exc:
        database = {"status": "error", "detail": type(exc).__name__}

    available, detail = provider_status()
    ai = {"status": "ok" if available else "unavailable"}
    if detail and not available:
        ai["detail"] = detail

    return {
        "status": "ok" if database["status"] == "ok" else "degraded",
        "service": settings.app_name,
        "environment": settings.environment,
        "checks": {"database": database, "ai": ai},
        "requestId": get_request_id(),
    }
