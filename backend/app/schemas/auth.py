from datetime import datetime

from pydantic import EmailStr, Field

from app.schemas.common import CamelModel


class RegisterRequest(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(CamelModel):
    id: str
    name: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime


class TokenResponse(CamelModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    session_id: str
    user: UserOut


class SessionOut(CamelModel):
    id: str
    user_agent: str
    ip_address: str
    last_seen_at: datetime
    created_at: datetime
    expires_at: datetime
    current: bool = False


class ProfileUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None


class ChangePasswordRequest(CamelModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class ForgotPasswordRequest(CamelModel):
    email: EmailStr


class ForgotPasswordResponse(CamelModel):
    detail: str
    reset_token: str | None = None


class ResetPasswordRequest(CamelModel):
    token: str = Field(min_length=20, max_length=256)
    password: str = Field(min_length=8, max_length=128)
