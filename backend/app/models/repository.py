from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, new_id


class Repository(Base, TimestampMixin):
    __tablename__ = "repositories"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", "full_name", name="uq_repository_owner_remote"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    provider: Mapped[str] = mapped_column(String(32), default="github", nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    org: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    external_id: Mapped[str | None] = mapped_column(String(64))
    clone_url: Mapped[str | None] = mapped_column(String(512))
    language: Mapped[str] = mapped_column(String(64), default="Unknown", nullable=False)
    branch: Mapped[str] = mapped_column(String(255), default="main", nullable=False)

    token_encrypted: Mapped[str | None] = mapped_column(Text)

    risk: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    critical: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    high: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    medium: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    loc: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    files: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="protected", nullable=False)
    last_scan_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_scan_id: Mapped[str | None] = mapped_column(String(32))

    owner = relationship("User", back_populates="repositories")
    scans = relationship(
        "Scan",
        back_populates="repository",
        cascade="all, delete-orphan",
        order_by="Scan.created_at.desc()",
    )
    findings = relationship(
        "Finding", back_populates="repository", cascade="all, delete-orphan"
    )
