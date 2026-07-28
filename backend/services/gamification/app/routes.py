"""HTTP layer for the Gamification Service.

Awards/grants are called by trusted internal services (Content, Assessment,
Progress) via the Gateway's service context, or by staff — never by students.
"""
from __future__ import annotations

from datetime import date

from flask import Blueprint, current_app, request
from pydantic import ValidationError

from lare_common.auth_context import current_identity, require_roles
from lare_common.errors import BadRequest
from lare_common.responses import created, ok

from .schemas import ActivityIn, AwardIn, BadgeIn, GrantBadgeIn
from .service import GamificationService

bp = Blueprint("gamification", __name__)

# Internal writers: platform services run as staff/company context.
WRITE = ("super_admin", "company_admin", "trainer")
READ = ("super_admin", "company_admin", "college_admin", "trainer", "student")


def _svc() -> GamificationService:
    return current_app.extensions["svc"]


def _db():
    return current_app.extensions["db"]


def _parse(model, payload):
    try:
        return model.model_validate(payload or {})
    except ValidationError as e:
        raise BadRequest("Validation failed", code="validation_error",
                         details=e.errors(include_url=False)) from e


@bp.post("/lms/v1/gamification/award")
@require_roles(*WRITE)
def award():
    data = _parse(AwardIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().award(s, data))


@bp.post("/lms/v1/gamification/activity")
@require_roles(*WRITE)
def activity():
    data = _parse(ActivityIn, request.get_json(silent=True))
    day = date.fromisoformat(data.day) if data.day else _svc()._today()
    with _db().session() as s:
        return ok(_svc().touch_activity(s, data.learner_id, day))


@bp.post("/lms/v1/gamification/badges")
@require_roles(*WRITE)
def create_badge():
    data = _parse(BadgeIn, request.get_json(silent=True))
    with _db().session() as s:
        b = _svc().create_badge(s, data)
        return created({"code": b.code, "name": b.name})


@bp.post("/lms/v1/gamification/badges/grant")
@require_roles(*WRITE)
def grant_badge():
    data = _parse(GrantBadgeIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().grant_badge(s, data.learner_id, data.badge_code))


@bp.get("/lms/v1/gamification/<learner_id>")
def game_state(learner_id):
    ident = current_identity()
    # Students may read their own; staff read any.
    if not ident.has_role(*WRITE) and not ident.has_role("college_admin") \
            and ident.user_id != learner_id:
        from lare_common.errors import Forbidden
        raise Forbidden("Not permitted")
    with _db().session() as s:
        return ok(_svc().game_state(s, learner_id))


@bp.get("/lms/v1/gamification/leaderboard/global")
@require_roles(*READ)
def leaderboard():
    limit = min(int(request.args.get("limit", 10)), 100)
    with _db().session() as s:
        return ok(_svc().leaderboard(s, limit))
