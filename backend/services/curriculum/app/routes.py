"""HTTP layer for the Curriculum Service."""
from __future__ import annotations

from flask import Blueprint, current_app, request
from pydantic import ValidationError

from lare_common.auth_context import require_roles
from lare_common.errors import BadRequest
from lare_common.responses import created, ok

from .schemas import (
    CurriculumIn, LessonIn, MapCohortIn, MapItemIn, ModuleIn, ObjectiveIn,
    OutcomeCheckIn, YearTrackIn,
)
from .service import CurriculumService

bp = Blueprint("curriculum", __name__)

# Curriculum designers = company_admin / super_admin; trainers/TPO read.
DESIGN = ("super_admin", "company_admin")
READ = ("super_admin", "company_admin", "college_admin", "trainer", "student")


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
@require_roles(*DESIGN)
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
@require_roles(*DESIGN)
def add_lesson(mid):
    data = _parse(LessonIn, request.get_json(silent=True))
    with _db().session() as s:
        l = _svc().add_lesson(s, mid, data)
        return created({"id": l.id, "title": l.title})


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
