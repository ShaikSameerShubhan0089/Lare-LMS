"""Notification logic: template rendering, preference-aware dispatch, in-app
inbox, idempotent sends.

Providers are pluggable: 'null' (dev, logs only), 'smtp'/'brevo' in production.
SMS/WhatsApp are designed-for and return 'not_configured' until adapters ship."""
from __future__ import annotations

import logging
import string
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from lare_common.errors import Conflict, NotFound
from lare_common.security import new_id

from .models import Notification, Preference, Template

log = logging.getLogger("lare-notify")


class _SafeDict(dict):
    def __missing__(self, key):  # leave unknown placeholders intact
        return "{" + key + "}"


def _render(text: str | None, variables: dict) -> str | None:
    if text is None:
        return None
    try:
        return string.Formatter().vformat(text, (), _SafeDict(**variables))
    except (ValueError, IndexError):
        return text  # malformed template — fail safe


class NotificationService:
    def __init__(self, email_provider: str = "null", sms_provider: str = "null"):
        from .providers import get_email_provider, get_sms_provider
        self.email_provider = email_provider
        self._email = get_email_provider(email_provider)
        self._sms = get_sms_provider(sms_provider)

    # ---------- templates ----------
    def upsert_template(self, s: Session, data) -> Template:
        t = s.execute(
            select(Template).where(
                Template.key == data.key, Template.channel == data.channel,
                Template.locale == data.locale)
        ).scalar_one_or_none()
        if t is None:
            t = Template(id=new_id(), key=data.key, channel=data.channel, locale=data.locale,
                         subject=data.subject, body=data.body, critical=data.critical)
            s.add(t)
        else:
            t.subject = data.subject
            t.body = data.body
            t.critical = data.critical
            t.version += 1
        s.flush()
        return t

    # ---------- preferences ----------
    def _channel_enabled(self, s: Session, user_id: str, channel: str) -> bool:
        p = s.execute(
            select(Preference).where(
                Preference.user_id == user_id, Preference.channel == channel)
        ).scalar_one_or_none()
        return True if p is None else p.enabled

    def set_preference(self, s: Session, user_id: str, channel: str, enabled: bool) -> dict:
        p = s.execute(
            select(Preference).where(
                Preference.user_id == user_id, Preference.channel == channel)
        ).scalar_one_or_none()
        if p is None:
            p = Preference(id=new_id(), user_id=user_id, channel=channel, enabled=enabled)
            s.add(p)
        else:
            p.enabled = enabled
        s.flush()
        return {"channel": channel, "enabled": enabled}

    def preferences(self, s: Session, user_id: str) -> list[dict]:
        rows = s.execute(
            select(Preference).where(Preference.user_id == user_id)
        ).scalars().all()
        return [{"channel": p.channel, "enabled": p.enabled} for p in rows]

    # ---------- send ----------
    def send(self, s: Session, data) -> dict:
        # idempotency
        if data.dedupe_key:
            dup = s.execute(
                select(Notification).where(
                    Notification.user_id == data.user_id,
                    Notification.template_key == data.template_key,
                    Notification.channel == data.channel,
                    Notification.dedupe_key == data.dedupe_key)
            ).scalar_one_or_none()
            if dup:
                return {"id": dup.id, "status": dup.status, "idempotent": True}

        tmpl = s.execute(
            select(Template).where(
                Template.key == data.template_key, Template.channel == data.channel,
                Template.locale == data.locale, Template.active.is_(True))
        ).scalar_one_or_none()
        if not tmpl:
            raise NotFound("Template not found", code="template_not_found")

        subject = _render(tmpl.subject, data.variables)
        body = _render(tmpl.body, data.variables)

        n = Notification(id=new_id(), user_id=data.user_id, template_key=data.template_key,
                         channel=data.channel, payload=data.variables, subject=subject,
                         body=body, dedupe_key=data.dedupe_key)
        s.add(n)

        # Preference respect (critical templates always send).
        if not tmpl.critical and not self._channel_enabled(s, data.user_id, data.channel):
            n.status = "suppressed"
        else:
            to = (data.variables or {}).get("email") or (data.variables or {}).get("phone")
            n.status = self._dispatch(data.channel, subject, body, to)
            if n.status == "sent":
                n.sent_at = datetime.now(tz=timezone.utc)
        s.flush()
        return {"id": n.id, "status": n.status, "channel": n.channel}

    def _dispatch(self, channel: str, subject, body, to: str | None = None) -> str:
        if channel == "inapp":
            return "sent"  # stored to the feed
        if channel == "email":
            return self._email.send(to=to, subject=subject, body=body)
        if channel in ("sms", "whatsapp"):
            return self._sms.send(to=to, body=body)
        return "not_configured"

    # ---------- template builder (req #22) ----------
    def list_templates(self, s: Session) -> list[dict]:
        rows = s.execute(select(Template).order_by(Template.key)).scalars().all()
        return [{"key": t.key, "channel": t.channel, "locale": t.locale,
                 "subject": t.subject, "body": t.body, "critical": t.critical,
                 "version": t.version, "active": t.active} for t in rows]

    def preview_template(self, s: Session, key: str, channel: str, variables: dict) -> dict:
        t = s.execute(
            select(Template).where(Template.key == key, Template.channel == channel)
        ).scalar_one_or_none()
        if not t:
            raise NotFound("Template not found", code="template_not_found")
        return {"subject": _render(t.subject, variables), "body": _render(t.body, variables)}

    @staticmethod
    def variables_catalog() -> dict:
        """Known merge variables per event/template (drives the builder UI)."""
        return {
            "year.completed": ["year_no", "attendance_pct", "avg_score"],
            "certificate.issued": ["certificate", "cert_no", "year_no"],
            "result.published": ["outcome", "rank"],
            "offer.created": ["kind", "role_title", "company_name"],
            "badge.earned": ["badge"],
            "interview.decided": ["decision", "stage"],
            "exam_reminder": ["name", "exam", "time"],
            "common": ["name", "email"],
        }

    # ---------- event-driven in-app (no template required) ----------
    def notify_inapp(self, s: Session, *, user_id: str, template_key: str,
                     subject: str, body: str, dedupe_key: str | None = None) -> dict:
        """Create an in-app notification directly from a domain event.

        Bypasses the template registry so event fan-out works without pre-seeded
        templates; still idempotent on dedupe_key (the event id)."""
        if dedupe_key:
            dup = s.execute(
                select(Notification).where(
                    Notification.user_id == user_id,
                    Notification.channel == "inapp",
                    Notification.dedupe_key == dedupe_key)
            ).scalar_one_or_none()
            if dup:
                return {"id": dup.id, "status": dup.status, "idempotent": True}
        n = Notification(id=new_id(), user_id=user_id, template_key=template_key,
                         channel="inapp", payload={}, subject=subject, body=body,
                         dedupe_key=dedupe_key, status="sent")
        n.sent_at = datetime.now(tz=timezone.utc)
        s.add(n)
        s.flush()
        return {"id": n.id, "status": n.status, "channel": "inapp"}

    def notify_email(self, s: Session, *, user_id: str, to: str | None,
                     template_key: str, subject: str, body: str,
                     from_name: str | None = None, reply_to: str | None = None,
                     dedupe_key: str | None = None) -> dict:
        """Send a templated-free email directly from a domain event, optionally
        'from' a company (display name + reply-to). Idempotent on dedupe_key and
        respects the user's email preference (unless there is no recipient)."""
        if dedupe_key:
            dup = s.execute(
                select(Notification).where(
                    Notification.user_id == user_id, Notification.channel == "email",
                    Notification.dedupe_key == dedupe_key)
            ).scalar_one_or_none()
            if dup:
                return {"id": dup.id, "status": dup.status, "idempotent": True}
        n = Notification(id=new_id(), user_id=user_id, template_key=template_key,
                         channel="email", payload={"email": to}, subject=subject,
                         body=body, dedupe_key=dedupe_key)
        s.add(n)
        if not to:
            n.status = "not_configured"
        elif not self._channel_enabled(s, user_id, "email"):
            n.status = "suppressed"
        else:
            n.status = self._email.send(to=to, subject=subject, body=body,
                                        from_name=from_name, reply_to=reply_to)
            if n.status == "sent":
                n.sent_at = datetime.now(tz=timezone.utc)
        s.flush()
        return {"id": n.id, "status": n.status, "channel": "email"}

    # ---------- inbox ----------
    def inbox(self, s: Session, user_id: str, unread_only: bool = False) -> list[dict]:
        q = select(Notification).where(
            Notification.user_id == user_id, Notification.channel == "inapp"
        ).order_by(Notification.created_at.desc())
        if unread_only:
            q = q.where(Notification.read_at.is_(None))
        rows = s.execute(q.limit(100)).scalars().all()
        return [{"id": n.id, "template_key": n.template_key, "subject": n.subject,
                 "body": n.body, "read": n.read_at is not None,
                 "created_at": n.created_at.isoformat()} for n in rows]

    def mark_read(self, s: Session, user_id: str, nid: str) -> dict:
        n = s.get(Notification, nid)
        if not n or n.user_id != user_id:
            raise NotFound("Notification not found", code="notification_not_found")
        if n.read_at is None:
            n.read_at = datetime.now(tz=timezone.utc)
        s.flush()
        return {"id": nid, "read": True}
