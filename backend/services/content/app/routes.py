"""HTTP layer for the Content Delivery Service.

Learner-scoped reads (playlist, recommendations) live under the /lms/v1/content
prefix so the Gateway routes them here, not to the Learner Service."""
from __future__ import annotations

from flask import Blueprint, current_app, request
from pydantic import ValidationError

from lare_common.auth_context import current_identity, require_roles
from lare_common.errors import BadRequest
from lare_common.responses import created, ok

from .schemas import ContentIn, GateIn, ProgressIn
from .service import ContentService

bp = Blueprint("content", __name__)

AUTHOR = ("super_admin", "company_admin", "trainer")
READ = ("super_admin", "company_admin", "college_admin", "trainer", "student")


def _svc() -> ContentService:
    return current_app.extensions["svc"]


def _db():
    return current_app.extensions["db"]


def _parse(model, payload):
    try:
        return model.model_validate(payload or {})
    except ValidationError as e:
        raise BadRequest("Validation failed", code="validation_error",
                         details=e.errors(include_url=False)) from e


@bp.post("/lms/v1/content")
@require_roles(*AUTHOR)
def create():
    data = _parse(ContentIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().out(_svc().create(s, data)))


@bp.get("/lms/v1/content")
@require_roles(*READ)
def list_content():
    lesson_id = request.args.get("lesson_id")
    if not lesson_id:
        raise BadRequest("lesson_id is required", code="lesson_id_required")
    with _db().session() as s:
        return ok([_svc().out(i) for i in _svc().list_for_lesson(s, lesson_id)])


@bp.post("/lms/v1/content/<cid>/gate")
@require_roles(*AUTHOR)
def add_gate(cid):
    data = _parse(GateIn, request.get_json(silent=True))
    with _db().session() as s:
        g = _svc().add_gate(s, cid, data.prereq_content_item_id)
        return created({"id": g.id, "content_item_id": cid,
                        "prereq": data.prereq_content_item_id})


@bp.get("/lms/v1/content/playlist")
@require_roles(*READ)
def playlist():
    learner_id = request.args.get("learner_id")
    lesson_id = request.args.get("lesson_id")
    if not learner_id:
        raise BadRequest("learner_id is required", code="learner_id_required")
    with _db().session() as s:
        return ok(_svc().playlist(s, learner_id, lesson_id))


@bp.get("/lms/v1/content/recommendations")
@require_roles(*READ)
def recommendations():
    learner_id = request.args.get("learner_id")
    if not learner_id:
        raise BadRequest("learner_id is required", code="learner_id_required")
    limit = min(int(request.args.get("limit", 5)), 20)
    with _db().session() as s:
        return ok(_svc().recommend(s, learner_id, limit))


@bp.post("/lms/v1/content/<cid>/progress")
def progress(cid):
    current_identity()
    data = _parse(ProgressIn, request.get_json(silent=True))
    with _db().session() as s:
        c = _svc().progress(s, cid, data)
        return ok({"content_item_id": cid, "status": c.status,
                   "position_sec": c.position_sec})


@bp.get("/lms/v1/content/<cid>/play")
@require_roles(*READ)
def play(cid):
    with _db().session() as s:
        return ok(_svc().play(s, cid))
