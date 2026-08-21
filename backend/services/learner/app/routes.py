"""HTTP layer for the Learner Service."""
from __future__ import annotations

from flask import Blueprint, current_app, request
from pydantic import ValidationError

from lare_common.auth_context import (
    current_identity, current_scope, require_permission, require_roles,
)
from lare_common.errors import BadRequest, Forbidden
from lare_common.responses import created, ok

from .schemas import ImportIn, LearnerIn, ProjectIn, PromoteIn, StreamIn
from .service import LearnerService

bp = Blueprint("learner", __name__)

MANAGE = ("super_admin", "company_admin", "college_admin")
READ = ("super_admin", "company_admin", "college_admin", "trainer")


def _svc() -> LearnerService:
    return current_app.extensions["svc"]


def _db():
    return current_app.extensions["db"]


def _parse(model, payload):
    try:
        return model.model_validate(payload or {})
    except ValidationError as e:
        raise BadRequest("Validation failed", code="validation_error",
                         details=e.errors(include_url=False)) from e


@bp.post("/lms/v1/learners")
@require_roles(*MANAGE)
def create():
    data = _parse(LearnerIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().out(_svc().create(s, data)))


@bp.get("/lms/v1/learners")
@require_roles(*READ)
def list_learners():
    college_id = request.args.get("college_id")
    limit = min(int(request.args.get("limit", 50)), 500)
    scope = current_scope()
    with _db().session() as s:
        return ok([_svc().out(l) for l in _svc().list(s, college_id, limit, scope)])


ANALYTICS_VIEW = ("analytics.platform.view", "analytics.college.view",
                  "analytics.branch.view", "analytics.section.view",
                  "analytics.student.view")


@bp.get("/lms/v1/students/me/home")
def student_home():
    # A student's own dashboard + year-wise roadmap. Keyed to the caller.
    ident = current_identity()
    with _db().session() as s:
        return ok(_svc().student_home(s, ident.user_id))


@bp.get("/lms/v1/students/modules/<mid>/resources")
def student_module_resources(mid):
    current_identity()  # any authenticated learner
    with _db().session() as s:
        return ok(_svc().module_resources(s, mid))


@bp.get("/lms/v1/roster/rollup")
@require_permission(*ANALYTICS_VIEW)
def roster_rollup():
    # Hierarchical drill-down: Platform → College → Branch → Section → Student,
    # aggregated from the real roster and clipped to the caller's data scope.
    level = request.args.get("level", "platform")
    parent_id = request.args.get("parent_id") or None
    scope = current_scope()
    with _db().session() as s:
        return ok(_svc().rollup(s, scope, level, parent_id))


@bp.post("/lms/v1/learners/import")
@require_roles(*MANAGE)
def bulk_import():
    data = _parse(ImportIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().bulk_import(s, data))


@bp.post("/lms/v1/learners/<lid>/verify")
@require_roles(*MANAGE)
def verify(lid):
    with _db().session() as s:
        return ok(_svc().out(_svc().verify(s, lid)))


@bp.get("/lms/v1/learners/<lid>/stream")
@require_roles(*READ)
def get_stream(lid):
    with _db().session() as s:
        sel = _svc().get_stream(s, lid)
        return ok(None if not sel else {"stream": sel.stream, "rationale": sel.rationale,
                                        "mentor_user_id": sel.mentor_user_id})


@bp.put("/lms/v1/learners/<lid>/stream")
@require_roles(*READ)  # trainers/mentors record the counselled choice
def set_stream(lid):
    data = _parse(StreamIn, request.get_json(silent=True))
    with _db().session() as s:
        sel = _svc().set_stream(s, lid, data)
        return ok({"stream": sel.stream, "rationale": sel.rationale})


@bp.get("/lms/v1/learners/<lid>/projects")
def list_projects(lid):
    current_identity()
    with _db().session() as s:
        return ok([_svc().project_out(p) for p in _svc().list_projects(s, lid)])


@bp.post("/lms/v1/learners/<lid>/projects")
def add_project(lid):
    ident = current_identity()
    data = _parse(ProjectIn, request.get_json(silent=True))
    with _db().session() as s:
        lr = _svc().get(s, lid)
        # Students may add projects only to their own portfolio.
        if ident.has_role("student") and not ident.has_role(*READ) and lr.user_id != ident.user_id:
            raise Forbidden("Cannot edit another learner's portfolio")
        return created(_svc().project_out(_svc().add_project(s, lid, data)))


@bp.post("/lms/v1/learners/<lid>/promote")
@require_roles(*MANAGE)
def promote(lid):
    data = _parse(PromoteIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().out(_svc().promote(s, lid, data)))


@bp.get("/lms/v1/learners/<lid>/profile")
def profile(lid):
    ident = current_identity()
    with _db().session() as s:
        lr = _svc().get(s, lid)
        # Staff see any learner in scope; a student sees only their own profile.
        if not ident.has_role(*READ) and lr.user_id != ident.user_id:
            raise Forbidden("Not permitted to view this profile")
        return ok(_svc().profile(s, lid))
