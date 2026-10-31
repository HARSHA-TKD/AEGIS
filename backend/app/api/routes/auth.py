import hashlib
import logging
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_session, get_current_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.db import get_db, utcnow
from app.models import AuthSession, PasswordResetToken, User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    ProfileUpdate,
    RegisterRequest,
    ResetPasswordRequest,
    SessionOut,
    TokenResponse,
    UserOut,
)
from app.schemas.common import Message
from app.services.email import send_password_reset

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _token_response(
    user: User, session: AuthSession, db: Session
) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(
            user.id, session_id=session.id
        ),
        expires_in=settings.access_token_expire_minutes * 60,
        session_id=session.id,
        user=UserOut.model_validate(user),
    )


def _create_session(user: User, request: Request, db: Session) -> AuthSession:
    expires_at = utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    session = AuthSession(
        user_id=user.id,
        user_agent=(request.headers.get("user-agent") or "")[:512],
        ip_address=(request.client.host if request.client else "")[:64],
        last_seen_at=utcnow(),
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _revoke_other_sessions(
    db: Session, user_id: str, keep_id: str | None = None
) -> None:
    sessions = db.scalars(
        select(AuthSession).where(
            AuthSession.user_id == user_id,
            AuthSession.revoked_at.is_(None),
        )
    )
    now = utcnow()
    for session in sessions:
        if keep_id is not None and session.id == keep_id:
            continue
        session.revoked_at = now
    db.commit()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest, request: Request, db: Session = Depends(get_db)
) -> TokenResponse:
    email = payload.email.lower()
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role="owner",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    session = _create_session(user, request, db)
    return _token_response(user, session, db)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest, request: Request, db: Session = Depends(get_db)
) -> TokenResponse:
    email = payload.email.lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been disabled.")
    session = _create_session(user, request, db)
    return _token_response(user, session, db)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserOut:
    if payload.name is None and payload.email is None:
        raise HTTPException(status_code=400, detail="Nothing to update.")

    if payload.email is not None:
        email = payload.email.lower()
        existing = db.scalar(
            select(User).where(User.email == email, User.id != user.id)
        )
        if existing is not None:
            raise HTTPException(
                status_code=409, detail="An account with this email already exists."
            )
        user.email = email
    if payload.name is not None:
        user.name = payload.name.strip()

    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/change-password", response_model=Message)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    session: AuthSession = Depends(get_current_session),
) -> Message:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    _revoke_other_sessions(db, user.id, keep_id=session.id)
    return Message(detail="Password updated. Other sessions were signed out.")


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    payload: ForgotPasswordRequest, db: Session = Depends(get_db)
) -> ForgotPasswordResponse:
    generic = "If that email is registered, a password reset link is on its way."
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not user.is_active:
        return ForgotPasswordResponse(detail=generic)

    now = utcnow()
    existing = db.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
    )
    for token in existing:
        token.used_at = now

    raw_token = secrets.token_urlsafe(40)
    reset = PasswordResetToken(
        user_id=user.id,
        token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
        expires_at=now + timedelta(minutes=settings.password_reset_expire_minutes),
    )
    db.add(reset)
    db.commit()

    reset_url = (
        f"{settings.frontend_url.rstrip('/')}/reset-password?token={raw_token}"
    )
    try:
        send_password_reset(user.email, reset_url)
    except Exception:
        logger.exception("could not send password reset email")

    exposed = raw_token if settings.environment in {"development", "test"} else None
    return ForgotPasswordResponse(detail=generic, reset_token=exposed)


@router.post("/reset-password", response_model=Message)
def reset_password(
    payload: ResetPasswordRequest, db: Session = Depends(get_db)
) -> Message:
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    reset = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
        )
    )
    now = utcnow()
    if reset is None or reset.expires_at <= now:
        raise HTTPException(
            status_code=400, detail="This reset link is invalid or has expired."
        )

    user = db.get(User, reset.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=400, detail="This account is unavailable.")

    user.password_hash = hash_password(payload.password)
    reset.used_at = now
    db.commit()
    _revoke_other_sessions(db, user.id)
    return Message(detail="Your password has been reset. Sign in with the new password.")


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: AuthSession = Depends(get_current_session),
) -> list[SessionOut]:
    now = utcnow()
    sessions = db.scalars(
        select(AuthSession)
        .where(
            AuthSession.user_id == user.id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        )
        .order_by(AuthSession.last_seen_at.desc())
    )
    return [
        SessionOut(
            id=session.id,
            user_agent=session.user_agent,
            ip_address=session.ip_address,
            last_seen_at=session.last_seen_at,
            created_at=session.created_at,
            expires_at=session.expires_at,
            current=session.id == current.id,
        )
        for session in sessions
    ]


@router.delete("/sessions/{session_id}", response_model=Message)
def revoke_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Message:
    session = db.get(AuthSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.revoked_at is None:
        session.revoked_at = utcnow()
        db.commit()
    return Message(detail="Session signed out.")


@router.delete("/sessions", response_model=Message)
def revoke_other_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: AuthSession = Depends(get_current_session),
) -> Message:
    _revoke_other_sessions(db, user.id, keep_id=current.id)
    return Message(detail="Other sessions signed out.")


@router.post("/logout", response_model=Message)
def logout(
    db: Session = Depends(get_db),
    current: AuthSession = Depends(get_current_session),
) -> Message:
    if current.revoked_at is None:
        current.revoked_at = utcnow()
        db.commit()
    return Message(detail="Signed out.")
