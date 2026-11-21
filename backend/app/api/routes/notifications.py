from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.models import FeedEvent, User

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    rows = db.scalars(
        select(FeedEvent)
        .where(FeedEvent.user_id == user.id)
        .order_by(FeedEvent.created_at.desc())
        .limit(limit)
    ).all()
    return [
        {
            "id": row.id,
            "kind": row.kind,
            "title": row.title,
            "detail": row.detail,
            "createdAt": row.created_at,
            "read": False,
        }
        for row in rows
    ]
