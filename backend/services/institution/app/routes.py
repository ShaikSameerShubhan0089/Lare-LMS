"""HTTP layer for the Institution Service."""
from __future__ import annotations

import time

import jwt
from flask import Blueprint, current_app, request
from pydantic import ValidationError

ACCESS_GRANT_TTL = 12 * 3600  # 12h, matches the access-session lifetime


def _mint_grant(user_id: str, cohort_id: str) -> str:
    """Short-lived LMS access grant, signed with the shared internal secret so
    the Gateway can verify it statelessly for student /lms/* routes."""
    now = int(time.time())
    secret = current_app.config["LARE"].INTERNAL_JWT_SECRET
    return jwt.encode(
        {"sub": user_id, "cohort_id": cohort_id, "scope": "lms_access",
         "iat": now, "exp": now + ACCESS_GRANT_TTL},
        secret, algorithm="HS256")

from lare_common.auth_context import current_identity, current_scope, require_roles
from lare_common.errors import BadRequest, Forbidden
from lare_common.responses import created, ok

from .schemas import (
    AcademicYearIn, AccessCodeIn, AccessCodeStatusIn, AccessValidateIn, AssignmentIn,
    BranchIn, CohortIn, CollegeIn, ConfigIn, ScheduleSlotIn,
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
    scope = current_scope()
    with _db().session() as s:
        return ok([_svc().college_out(c) for c in _svc().list_colleges(s, limit, scope)])


@bp.get("/lms/v1/colleges/<cid>")
@require_roles(*READ)
def get_college(cid):
    scope = current_scope()
    if not scope.unrestricted and cid not in scope.college_ids:
        raise Forbidden("Outside your college scope")
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


# ---------- Access Gate ----------
@bp.post("/lms/v1/access/codes")
@require_roles(*MANAGE_COLLEGE)
def create_access_code():
    data = _parse(AccessCodeIn, request.get_json(silent=True))
    with _db().session() as s:
        ac = _svc().create_access_code(s, data, current_identity().user_id)
        return created(_svc().access_code_out(ac))


@bp.get("/lms/v1/access/codes")
@require_roles(*READ)
def list_access_codes():
    cohort_id = request.args.get("cohort_id")
    with _db().session() as s:
        return ok([_svc().access_code_out(ac) for ac in _svc().list_access_codes(s, cohort_id)])


@bp.post("/lms/v1/access/codes/<cid>/status")
@require_roles(*MANAGE_COLLEGE)
def set_access_status(cid):
    data = _parse(AccessCodeStatusIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().access_code_out(_svc().set_access_status(s, cid, data.status)))


@bp.post("/lms/v1/access/codes/<cid>/regenerate")
@require_roles(*MANAGE_COLLEGE)
def regenerate_access_code(cid):
    with _db().session() as s:
        return ok(_svc().access_code_out(_svc().regenerate_access_code(s, cid)))


@bp.post("/lms/v1/access/validate")
def validate_access():
    """Student presents the group Access ID (any logged-in LMS user)."""
    data = _parse(AccessValidateIn, request.get_json(silent=True))
    uid = current_identity().user_id
    with _db().session() as s:
        result = _svc().validate_access(s, data.code, uid)
    result["grant"] = _mint_grant(uid, result["cohort_id"])
    return ok(result)


@bp.get("/lms/v1/access/me")
def my_access():
    """Whether this user has a valid access session (else the SPA shows the gate)."""
    with _db().session() as s:
        sess = _svc().access_session(s, current_identity().user_id)
        return ok({"granted": bool(sess), "access": sess})


@bp.post("/lms/v1/access/exit")
def exit_access():
    with _db().session() as s:
        _svc().clear_access_session(s, current_identity().user_id)
        return ok({"cleared": True})
