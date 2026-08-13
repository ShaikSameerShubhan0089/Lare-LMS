"""HTTP layer for the Action (attention) service.

GET recomputes from live cross-service state (best-effort east-west to evidence
+ decision) so the queue is always current; resolution is persisted user state.
"""
from __future__ import annotations

from flask import Blueprint, current_app, request

from lare_common.auth_context import current_identity, require_roles
from lare_common.responses import ok
from lare_common.service_client import ServiceClient

from .service import ActionService

bp = Blueprint("action", __name__)

MANAGE = ("super_admin", "company_admin", "recruiter")
READ = ("super_admin", "company_admin", "recruiter", "college_admin", "trainer")

_client = ServiceClient("drive-action", default_roles=["recruiter"])


def _svc() -> ActionService:
    return current_app.extensions["svc"]


def _db():
    return current_app.extensions["db"]


def _conflicts(drive_id, uid):
    try:
        r = _client.get("drive-evidence", f"/drive/v1/evidence/drive/{drive_id}/conflicts", user_id=uid)
        return (r or {}).get("data") or []
    except Exception:  # noqa: BLE001
        return []


def _queue(drive_id, uid):
    try:
        r = _client.get("drive-decision", f"/drive/v1/decisions/drive/{drive_id}/queue", user_id=uid)
        return (r or {}).get("data") or []
    except Exception:  # noqa: BLE001
        return []


@bp.get("/drive/v1/actions/drive/<did>")
@require_roles(*READ)
def list_actions(did):
    ident = current_identity()
    conflicts = _conflicts(did, ident.user_id)
    queue = _queue(did, ident.user_id)
    with _db().session() as s:
        return ok(_svc().recompute(s, did, conflicts, queue))


@bp.post("/drive/v1/actions/<aid>/resolve")
@require_roles(*MANAGE)
def resolve(aid):
    ident = current_identity()
    status = (request.get_json(silent=True) or {}).get("status", "resolved")
    if status not in ("resolved", "dismissed"):
        status = "resolved"
    with _db().session() as s:
        return ok(_svc().resolve(s, aid, ident.user_id, status=status))
