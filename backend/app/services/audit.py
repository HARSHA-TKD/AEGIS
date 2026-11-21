import logging

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditLog, User

logger = logging.getLogger(__name__)

_SENSITIVE = ("token", "password", "secret", "authorization", "api_key", "apikey")


def _clean_detail(detail: dict | None) -> dict:
    if not isinstance(detail, dict):
        return {}
    cleaned: dict = {}
    for key, value in detail.items():
        name = str(key).lower()
        if any(part in name for part in _SENSITIVE):
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            cleaned[str(key)] = value
    return cleaned


def record_audit(
    db: Session,
    *,
    actor: User | None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    detail: dict | None = None,
    request: Request | None = None,
) -> AuditLog | None:
    try:
        entry = AuditLog(
            actor_id=actor.id if actor is not None else None,
            actor_email=actor.email if actor is not None else "",
            action=action[:64],
            target_type=(target_type or "")[:64],
            target_id=str(target_id)[:64] if target_id is not None else None,
            detail=_clean_detail(detail),
            ip_address=(request.client.host if request is not None and request.client else "")[:64],
            user_agent=((request.headers.get("user-agent") or "") if request is not None else "")[:512],
        )
        db.add(entry)
        db.commit()
        return entry
    except Exception:
        logger.exception("could not record audit event")
        db.rollback()
        return None
