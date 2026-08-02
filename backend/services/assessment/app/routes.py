"""HTTP layer for the Assessment Service."""
from __future__ import annotations

from flask import Blueprint, current_app, request
from pydantic import ValidationError

from lare_common.auth_context import current_identity, require_roles
from lare_common.errors import BadRequest, Forbidden
from lare_common.responses import created, ok

from .schemas import AssessmentIn, GradeIn, StartIn, SubmitIn
from .service import AssessmentService

bp = Blueprint("assessment", __name__)

AUTHOR = ("super_admin", "company_admin", "trainer")
READ = ("super_admin", "company_admin", "college_admin", "trainer", "student")


def _svc() -> AssessmentService:
    return current_app.extensions["svc"]


def _db():
    return current_app.extensions["db"]


def _parse(model, payload):
    try:
        return model.model_validate(payload or {})
    except ValidationError as e:
        raise BadRequest("Validation failed", code="validation_error",
                         details=e.errors(include_url=False)) from e


@bp.post("/lms/v1/assessments")
@require_roles(*AUTHOR)
def create():
    data = _parse(AssessmentIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().out(_svc().create(s, data)))


@bp.get("/lms/v1/assessments/summary")
@require_roles(*READ)
def summary():
    learner_id = request.args.get("learner_id")
    if not learner_id:
        raise BadRequest("learner_id is required", code="learner_id_required")
    with _db().session() as s:
        return ok(_svc().summary(s, learner_id))


@bp.get("/lms/v1/assessments/twin/<learner_id>")
@require_roles(*READ)
def twin(learner_id):
    """LMS Cognitive Twin skill profile. A student sees only their own; staff
    (trainers/admins) may view any learner's."""
    ident = current_identity()
    staff = ("super_admin", "company_admin", "college_admin", "trainer")
    if not ident.has_role(*staff) and learner_id != ident.user_id:
        raise Forbidden("You can only view your own skill map.")
    with _db().session() as s:
        return ok(_svc().skill_profile(s, learner_id))


@bp.get("/lms/v1/assessments/<aid>")
@require_roles(*READ)
def get_assessment(aid):
    ident = current_identity()
    with _db().session() as s:
        a = _svc().get(s, aid)
        return ok({**_svc().out(a),
                   "items": _svc().delivery_items(s, a, ident.user_id)})


@bp.post("/lms/v1/assessments/<aid>/attempts")
def start(aid):
    ident = current_identity()
    data = _parse(StartIn, request.get_json(silent=True))
    # Students start their own attempt; staff may start on behalf (e.g. proctored).
    learner_id = data.learner_id or ident.user_id
    with _db().session() as s:
        return created(_svc().start(s, aid, learner_id))


@bp.post("/lms/v1/attempts/<attempt_id>/submit")
def submit(attempt_id):
    ident = current_identity()
    data = _parse(SubmitIn, request.get_json(silent=True))
    with _db().session() as s:
        result = _svc().submit(s, attempt_id, ident.user_id, data.answers)
    # Feed the scorecard (Progress) and XP (Gamification) via the event bus.
    bus = current_app.extensions.get("bus")
    if bus and result.get("percentage") is not None and not result.get("pending_grading"):
        bus.publish("assessment.scored", {
            "learner_id": result.get("learner_id") or ident.user_id,
            "assessment_id": result.get("assessment_id"),
            "score": result.get("percentage"), "passed": result.get("passed"),
            "category": data.category if hasattr(data, "category") else None,
        })
    return ok(result)


@bp.post("/lms/v1/answers/<answer_id>/grade")
@require_roles(*AUTHOR)
def grade(answer_id):
    ident = current_identity()
    data = _parse(GradeIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().grade_answer(s, answer_id, data.score, ident.user_id))
