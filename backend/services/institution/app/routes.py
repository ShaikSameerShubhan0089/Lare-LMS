"""HTTP layer for the Institution Service."""
from __future__ import annotations

from flask import Blueprint, current_app, request
from pydantic import ValidationError

from lare_common.auth_context import require_roles
from lare_common.errors import BadRequest
from lare_common.responses import created, ok

from .schemas import (
    AcademicYearIn, AssignmentIn, BranchIn, CohortIn, CollegeIn, ConfigIn,
    ScheduleSlotIn,
)
from .service import InstitutionService

bp = Blueprint("institution", __name__)

MANAGE = ("super_admin", "company_admin")
MANAGE_COLLEGE = ("super_admin", "company_admin", "college_admin")
READ = ("super_admin", "company_admin", "college_admin", "trainer")


def _svc() -> InstitutionService:
    return current_app.extensions["svc"]


def _db():
    return current_app.extensions["db"]


def _parse(model, payload):
    try:
        return model.model_validate(payload or {})
    except ValidationError as e:
        raise BadRequest("Validation failed", code="validation_error",
                         details=e.errors(include_url=False)) from e


# ---------- colleges ----------
@bp.post("/lms/v1/colleges")
@require_roles(*MANAGE)
def create_college():
    data = _parse(CollegeIn, request.get_json(silent=True))
    with _db().session() as s:
        c = _svc().create_college(s, data)
        return created(_svc().college_out(c))


@bp.get("/lms/v1/colleges")
@require_roles(*READ)
def list_colleges():
    limit = min(int(request.args.get("limit", 50)), 200)
    with _db().session() as s:
        return ok([_svc().college_out(c) for c in _svc().list_colleges(s, limit)])


@bp.get("/lms/v1/colleges/<cid>")
@require_roles(*READ)
def get_college(cid):
    with _db().session() as s:
        return ok(_svc().college_out(_svc().get_college(s, cid)))


# ---------- branches ----------
@bp.post("/lms/v1/colleges/<cid>/branches")
@require_roles(*MANAGE_COLLEGE)
def add_branch(cid):
    data = _parse(BranchIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().branch_out(_svc().add_branch(s, cid, data)))


@bp.get("/lms/v1/colleges/<cid>/branches")
@require_roles(*READ)
def list_branches(cid):
    with _db().session() as s:
        return ok([_svc().branch_out(b) for b in _svc().list_branches(s, cid)])


# ---------- calendar ----------
@bp.post("/lms/v1/colleges/<cid>/calendar")
@require_roles(*MANAGE_COLLEGE)
def add_year(cid):
    data = _parse(AcademicYearIn, request.get_json(silent=True))
    with _db().session() as s:
        ay = _svc().add_academic_year(s, cid, data)
        return created({"id": ay.id, "year_no": ay.year_no})


@bp.get("/lms/v1/colleges/<cid>/calendar")
@require_roles(*READ)
def list_calendar(cid):
    with _db().session() as s:
        return ok(_svc().list_calendar(s, cid))


# ---------- cohorts ----------
@bp.post("/lms/v1/colleges/<cid>/cohorts")
@require_roles(*MANAGE_COLLEGE)
def add_cohort(cid):
    data = _parse(CohortIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().cohort_out(_svc().add_cohort(s, cid, data)))


@bp.get("/lms/v1/colleges/<cid>/cohorts")
@require_roles(*READ)
def list_cohorts(cid):
    with _db().session() as s:
        return ok([_svc().cohort_out(c) for c in _svc().list_cohorts(s, cid)])


# ---------- schedule ----------
@bp.post("/lms/v1/colleges/<cid>/schedule")
@require_roles(*MANAGE_COLLEGE)
def add_slot(cid):
    data = _parse(ScheduleSlotIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().slot_out(_svc().add_slot(s, cid, data)))


@bp.get("/lms/v1/colleges/<cid>/schedule")
@require_roles(*READ)
def list_schedule(cid):
    with _db().session() as s:
        return ok([_svc().slot_out(sl) for sl in _svc().list_schedule(s, cid)])


# ---------- assignments & config ----------
@bp.post("/lms/v1/colleges/<cid>/assignments")
@require_roles(*MANAGE_COLLEGE)
def assign(cid):
    data = _parse(AssignmentIn, request.get_json(silent=True))
    with _db().session() as s:
        a = _svc().assign(s, cid, data)
        return created({"id": a.id, "user_id": a.user_id, "role": a.role})


@bp.get("/lms/v1/colleges/<cid>/config")
@require_roles(*READ)
def get_config(cid):
    with _db().session() as s:
        c = _svc().get_college(s, cid)
        return ok({"passing_threshold": c.passing_threshold,
                   "min_cohort_size": c.min_cohort_size})


@bp.put("/lms/v1/colleges/<cid>/config")
@require_roles(*MANAGE_COLLEGE)
def put_config(cid):
    data = _parse(ConfigIn, request.get_json(silent=True))
    with _db().session() as s:
        c = _svc().update_config(s, cid, data)
        return ok({"passing_threshold": c.passing_threshold,
                   "min_cohort_size": c.min_cohort_size})
