from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, new_id


class IntelFilter(Base, TimestampMixin):
    __tablename__ = "intel_filters"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    query: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    severity: Mapped[str | None] = mapped_column(String(24), nullable=True)
    exploited: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    sort: Mapped[str] = mapped_column(String(24), default="epss", nullable=False)
