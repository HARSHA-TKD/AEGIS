from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permission
from app.db import get_db
from app.models import AuditLog, User

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_audit(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("audit:read")),
    __: User = Depends(get_current_user),
) -> dict:
    total = db.scalar(select(func.count()).select_from(AuditLog)) or 0
    rows = db.scalars(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    ).all()
    return {
        "items": [
            {
                "id": row.id,
                "actorId": row.actor_id,
                "actorEmail": row.actor_email,
                "action": row.action,
                "targetType": row.target_type,
                "targetId": row.target_id,
                "detail": row.detail or {},
                "ipAddress": row.ip_address,
                "userAgent": row.user_agent,
                "createdAt": row.created_at,
            }
            for row in rows
        ],
        "total": total,
    }
