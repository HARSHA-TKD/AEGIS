from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, new_id


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="analyst", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    repositories = relationship(
        "Repository", back_populates="owner", cascade="all, delete-orphan"
    )
    reports = relationship("Report", back_populates="owner", cascade="all, delete-orphan")
    feed_events = relationship(
        "FeedEvent", back_populates="owner", cascade="all, delete-orphan"
    )
    sessions = relationship(
        "AuthSession", back_populates="user", cascade="all, delete-orphan"
    )
