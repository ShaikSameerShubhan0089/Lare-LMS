"""Certification models (schema: lms_certification)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from lare_common.db import Base
from lare_common.security import new_id


def _uuid() -> str:
    return new_id()


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class Template(Base):
    __tablename__ = "templates"
    __table_args__ = (UniqueConstraint("year_no", name="uq_template_year"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    year_no: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(255))
    signatories: Mapped[str | None] = mapped_column(String(512))
    version: Mapped[int] = mapped_column(Integer, default=1)


class Certificate(Base):
    __tablename__ = "certificates"
    # One certificate per learner per year (idempotent auto-issue).
    __table_args__ = (UniqueConstraint("learner_id", "year_no", name="uq_cert"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    learner_id: Mapped[str] = mapped_column(String(64), index=True)
    year_no: Mapped[int] = mapped_column(Integer)
    template_id: Mapped[str | None] = mapped_column(String(64))
    cert_no: Mapped[str] = mapped_column(String(64), unique=True)
    cert_name: Mapped[str] = mapped_column(String(255))
    verify_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    file_id: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), default="issued")  # issued | revoked
    ppo_tag: Mapped[bool] = mapped_column(Boolean, default=False)
    holder_name: Mapped[str | None] = mapped_column(String(255))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Revocation(Base):
    __tablename__ = "revocations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    certificate_id: Mapped[str] = mapped_column(ForeignKey("certificates.id", ondelete="CASCADE"))
    reason: Mapped[str | None] = mapped_column(String(512))
    revoked_by: Mapped[str | None] = mapped_column(String(64))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
