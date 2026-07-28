"""HTTP layer for the Interview Service."""
from __future__ import annotations

from flask import Blueprint, current_app, request
from pydantic import ValidationError

from lare_common.auth_context import current_identity, require_roles
from lare_common.errors import BadRequest
from lare_common.responses import created, ok

from .schemas import AllocateIn, DecisionIn, RateIn, ScheduleIn
from .service import InterviewService

bp = Blueprint("interview", __name__)

MANAGE = ("super_admin", "company_admin", "recruiter")
PANEL = ("super_admin", "company_admin", "recruiter")


def _svc() -> InterviewService:
    return current_app.extensions["svc"]


def _db():
    return current_app.extensions["db"]


def _parse(model, payload):
    try:
        return model.model_validate(payload or {})
    except ValidationError as e:
        raise BadRequest("Validation failed", code="validation_error",
                         details=e.errors(include_url=False)) from e


@bp.post("/drive/v1/interviews/schedule")
@require_roles(*MANAGE)
def schedule():
    data = _parse(ScheduleIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().out(_svc().schedule(s, data)))


@bp.post("/drive/v1/interviews/<iid>/allocate")
@require_roles(*MANAGE)
def allocate(iid):
    data = _parse(AllocateIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().out(_svc().allocate(s, iid, data.interviewer_id)))


@bp.get("/drive/v1/interviews/<iid>/dossier")
@require_roles(*PANEL)
def dossier(iid):
    with _db().session() as s:
        return ok(_svc().dossier(s, iid))


@bp.post("/drive/v1/interviews/<iid>/rate")
@require_roles(*PANEL)
def rate(iid):
    ident = current_identity()
    data = _parse(RateIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().rate(s, iid, ident.user_id, data))


@bp.post("/drive/v1/interviews/<iid>/decision")
@require_roles(*PANEL)
def decision(iid):
    ident = current_identity()
    data = _parse(DecisionIn, request.get_json(silent=True))
    with _db().session() as s:
        out = _svc().out(_svc().decide(s, iid, ident.user_id, data))
    bus = current_app.extensions.get("bus")
    if bus:
        bus.publish("interview.decided", {
            "drive_id": out.get("drive_id"), "candidate_id": out.get("candidate_id"),
            "decision": out.get("decision"), "stage": out.get("stage"),
        })
    return ok(out)


@bp.get("/drive/v1/interviews/drive/<drive_id>")
@require_roles(*MANAGE)
def for_drive(drive_id):
    with _db().session() as s:
        return ok(_svc().for_drive(s, drive_id))
