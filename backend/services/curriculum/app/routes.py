"""HTTP layer for the Curriculum Service."""
from __future__ import annotations

from flask import Blueprint, current_app, request
from pydantic import ValidationError

from lare_common.auth_context import current_identity, require_permission, require_roles

# Authoring content/curriculum: admins, trainers (lms.curriculum.manage) and
# faculty (academic.course.manage). Permission-gated so new roles work too.
AUTHOR_PERMS = ("lms.curriculum.manage", "academic.course.manage")
from lare_common.errors import BadRequest
from lare_common.responses import created, ok

from .schemas import (
    CurriculumIn, LessonContentIn, LessonIn, MapCohortIn, MapItemIn, ModuleIn,
    ObjectiveIn, OutcomeCheckIn, YearTrackIn,
)
from .service import CurriculumService

bp = Blueprint("curriculum", __name__)

# Curriculum designers = company_admin / super_admin; trainers/TPO read.
DESIGN = ("super_admin", "company_admin")
# Teaching material is authored by designers and trainers.
AUTHOR_CONTENT = ("super_admin", "company_admin", "trainer")
READ = ("super_admin", "company_admin", "college_admin", "trainer", "student")
STAFF = ("super_admin", "company_admin", "college_admin", "trainer")


def _svc() -> CurriculumService:
    return current_app.extensions["svc"]


def _db():
    return current_app.extensions["db"]


def _parse(model, payload):
    try:
        return model.model_validate(payload or {})
    except ValidationError as e:
        raise BadRequest("Validation failed", code="validation_error",
                         details=e.errors(include_url=False)) from e


@bp.post("/lms/v1/curricula")
@require_roles(*DESIGN)
def create():
    data = _parse(CurriculumIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().out(_svc().create(s, data)))


@bp.get("/lms/v1/curricula")
@require_roles(*READ)
def list_curricula():
    from .models import Curriculum
    from sqlalchemy import select
    with _db().session() as s:
        rows = s.execute(select(Curriculum).limit(100)).scalars().all()
        return ok([_svc().out(c) for c in rows])


@bp.get("/lms/v1/curricula/<cid>/tree")
@require_roles(*READ)
def tree(cid):
    with _db().session() as s:
        return ok(_svc().tree(s, cid))


@bp.post("/lms/v1/curricula/<cid>/years")
@require_roles(*DESIGN)
def add_year(cid):
    data = _parse(YearTrackIn, request.get_json(silent=True))
    with _db().session() as s:
        y = _svc().add_year(s, cid, data)
        return created({"id": y.id, "year_no": y.year_no, "theme": y.theme})


@bp.post("/lms/v1/years/<yid>/modules")
@require_permission(*AUTHOR_PERMS)
def add_module(yid):
    data = _parse(ModuleIn, request.get_json(silent=True))
    with _db().session() as s:
        m = _svc().add_module(s, yid, data)
        return created({"id": m.id, "title": m.title, "branch_scope": m.branch_scope})


@bp.post("/lms/v1/years/<yid>/outcome-checks")
@require_roles(*DESIGN)
def add_outcome(yid):
    data = _parse(OutcomeCheckIn, request.get_json(silent=True))
    with _db().session() as s:
        oc = _svc().add_outcome_check(s, yid, data)
        return created({"id": oc.id, "statement": oc.statement})


@bp.post("/lms/v1/modules/<mid>/lessons")
@require_permission(*AUTHOR_PERMS)
def add_lesson(mid):
    data = _parse(LessonIn, request.get_json(silent=True))
    with _db().session() as s:
        l = _svc().add_lesson(s, mid, data)
        return created(_svc().lesson_out(l))


@bp.get("/lms/v1/lessons/<lid>")
@require_roles(*READ)
def get_lesson(lid):
    """A lesson with its living-lesson blocks. Students get check answers
    stripped (so the key isn't leaked before answering); staff get the full
    lesson for editing."""
    ident = current_identity()
    for_learner = not ident.has_role(*STAFF)
    with _db().session() as s:
        return ok(_svc().lesson_out(_svc().get_lesson(s, lid), for_learner=for_learner))


@bp.put("/lms/v1/lessons/<lid>/content")
@require_roles(*AUTHOR_CONTENT)
def set_lesson_content(lid):
    data = _parse(LessonContentIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().lesson_out(_svc().set_lesson_content(s, lid, data.content)))


@bp.post("/lms/v1/lessons/<lid>/check")
@require_roles(*READ)
def grade_lesson_check(lid):
    b = request.get_json(silent=True) or {}
    block_id = b.get("block_id")
    if not block_id:
        raise BadRequest("block_id is required", code="block_id_required")
    with _db().session() as s:
        return ok(_svc().grade_check(s, lid, block_id, b.get("choice", "")))


@bp.post("/lms/v1/lessons/<lid>/objectives")
@require_roles(*DESIGN)
def add_objective(lid):
    data = _parse(ObjectiveIn, request.get_json(silent=True))
    with _db().session() as s:
        o = _svc().add_objective(s, lid, data)
        return created({"id": o.id, "statement": o.statement, "skill_tag": o.skill_tag})


@bp.post("/lms/v1/curricula/<cid>/publish")
@require_roles(*DESIGN)
def publish(cid):
    with _db().session() as s:
        return ok(_svc().out(_svc().publish(s, cid)))


@bp.post("/lms/v1/curricula/<cid>/map-cohort")
@require_roles("super_admin", "company_admin", "college_admin")
def map_cohort(cid):
    data = _parse(MapCohortIn, request.get_json(silent=True))
    with _db().session() as s:
        cc = _svc().map_cohort(s, cid, data)
        return created({"id": cc.id, "cohort_id": cc.cohort_id, "curriculum_id": cc.curriculum_id})


@bp.post("/lms/v1/objectives/<oid>/items")
@require_roles(*DESIGN)
def map_item(oid):
    data = _parse(MapItemIn, request.get_json(silent=True))
    with _db().session() as s:
        _svc().map_item(s, oid, data)
        return created({"objective_id": oid, "item_type": data.item_type, "item_id": data.item_id})


@bp.get("/lms/v1/objectives/<oid>/items")
@require_roles(*READ)
def objective_items(oid):
    with _db().session() as s:
        return ok(_svc().objective_items(s, oid))
