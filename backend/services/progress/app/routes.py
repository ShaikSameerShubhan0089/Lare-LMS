"""HTTP layer for the Progress Tracking Service."""
from __future__ import annotations

from flask import Blueprint, current_app, request
from pydantic import ValidationError

from lare_common.auth_context import current_identity, require_roles
from lare_common.errors import BadRequest, Forbidden
from lare_common.responses import created, ok

from .schemas import AttendanceIn, ComputeYearIn, ModuleProgressIn, ScoreIn
from .service import ProgressService

bp = Blueprint("progress", __name__)

STAFF = ("super_admin", "company_admin", "college_admin", "trainer")
READ = ("super_admin", "company_admin", "college_admin", "trainer", "student")


def _svc() -> ProgressService:
    return current_app.extensions["svc"]


def _db():
    return current_app.extensions["db"]


def _parse(model, payload):
    try:
        return model.model_validate(payload or {})
    except ValidationError as e:
        raise BadRequest("Validation failed", code="validation_error",
                         details=e.errors(include_url=False)) from e


# Score events / attendance / module progress are written by staff or by
# trusted internal services (Assessment, Coding, Interview) — never by students.
@bp.post("/lms/v1/attendance")
@require_roles(*STAFF)
def mark_attendance():
    data = _parse(AttendanceIn, request.get_json(silent=True))
    with _db().session() as s:
        a = _svc().mark_attendance(s, data)
        return created({"id": a.id, "status": a.status})


@bp.post("/lms/v1/progress/module")
@require_roles(*STAFF)
def module_progress():
    data = _parse(ModuleProgressIn, request.get_json(silent=True))
    with _db().session() as s:
        mp = _svc().set_module_progress(s, data)
        return ok({"module_id": mp.module_id, "completion_pct": mp.completion_pct})


@bp.post("/lms/v1/progress/score")
@require_roles(*STAFF)
def record_score():
    data = _parse(ScoreIn, request.get_json(silent=True))
    with _db().session() as s:
        card = _svc().record_score(s, data)
        return ok(_svc().card_out(card))


@bp.post("/lms/v1/progress/compute-year")
@require_roles(*STAFF)
def compute_year():
    data = _parse(ComputeYearIn, request.get_json(silent=True))
    with _db().session() as s:
        result = _svc().compute_year(s, data.learner_id, data.year_no)
    # On completion, signal Certification (auto-issue) + Notification/Analytics.
    if result.get("criteria_met"):
        bus = current_app.extensions.get("bus")
        if bus:
            bus.publish("year.completed", {
                "learner_id": result["learner_id"], "year_no": result["year_no"],
                "attendance_pct": result.get("attendance_pct"),
                "avg_score": result.get("avg_score"),
                "criteria_met": True, "ppo_tag": data.year_no == 4,
                "college_id": getattr(data, "college_id", None),
            })
    return ok(result)


def _scope_guard(learner_user_id_param: str):
    """Students may read only their own progress; staff read any."""
    ident = current_identity()
    if ident.has_role(*STAFF):
        return
    # For students, the learner_id in the path is expected to equal their user id
    # in the simplest mapping; a full mapping resolves learner->user via Learner
    # service. Here we enforce self-only by matching the query param.
    if ident.user_id != learner_user_id_param:
        raise Forbidden("Not permitted to view another learner's progress")


@bp.get("/lms/v1/progress/<learner_id>")
def summary(learner_id):
    _scope_guard(learner_id)
    with _db().session() as s:
        return ok(_svc().summary(s, learner_id))


@bp.get("/lms/v1/progress/<learner_id>/scorecard")
def scorecard(learner_id):
    _scope_guard(learner_id)
    with _db().session() as s:
        return ok(_svc().scorecard(s, learner_id))
