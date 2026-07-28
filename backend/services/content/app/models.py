"""Content delivery models (schema: lms_content)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from lare_common.db import Base
from lare_common.security import new_id


def _uuid() -> str:
    return new_id()


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class ContentItem(Base):
    __tablename__ = "content_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    lesson_id: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(255))
    # video | pdf | slide | reading | interactive | link
    type: Mapped[str] = mapped_column(String(16))
    file_id: Mapped[str | None] = mapped_column(String(64))
    url: Mapped[str | None] = mapped_column(String(512))
    duration_sec: Mapped[int] = mapped_column(Integer, default=0)
    difficulty: Mapped[str] = mapped_column(String(16), default="easy")  # easy|medium|hard
    order: Mapped[int] = mapped_column(Integer, default=0)
    objectives: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Gate(Base):
    __tablename__ = "gates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    content_item_id: Mapped[str] = mapped_column(
        ForeignKey("content_items.id", ondelete="CASCADE"), index=True
    )
    # prereq_content: rule_config = {"content_item_id": "..."}
    rule_type: Mapped[str] = mapped_column(String(32), default="prereq_content")
    rule_config: Mapped[dict] = mapped_column(JSON, default=dict)


class Consumption(Base):
    __tablename__ = "consumption"
    __table_args__ = (
        UniqueConstraint("learner_id", "content_item_id", name="uq_consumption"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    content_item_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16), default="in_progress")  # in_progress|completed
    position_sec: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )
