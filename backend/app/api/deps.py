from datetime import timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_payload
from app.db import get_db, utcnow
from app.models import AuthSession, User

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthSession:
    if credentials is None or not credentials.credentials:
        raise _unauthorized()

    payload = decode_access_payload(credentials.credentials)
    if payload is None:
        raise _unauthorized()

    session_id = payload.get("sid")
    if not isinstance(session_id, str):
        raise _unauthorized()

    session = db.get(AuthSession, session_id)
    now = utcnow()
    if (
        session is None
        or session.revoked_at is not None
        or session.expires_at <= now
        or session.user_id != payload["sub"]
    ):
        raise _unauthorized()

    if session.last_seen_at < now - timedelta(minutes=5):
        session.last_seen_at = now
        db.commit()

    return session


def get_current_user(
    session: AuthSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise _unauthorized()
    return user
