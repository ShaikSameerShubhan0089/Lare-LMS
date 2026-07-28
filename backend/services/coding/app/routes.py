"""HTTP layer for the Coding Assessment Service."""
from __future__ import annotations

from flask import Blueprint, current_app, request
from pydantic import ValidationError

from lare_common.auth_context import current_identity, require_roles
from lare_common.errors import BadRequest
from lare_common.responses import created, ok

from .schemas import OpenSessionIn, ProblemIn, RunIn, SaveIn
from .service import CodingService

bp = Blueprint("coding", __name__)

AUTHOR = ("super_admin", "company_admin", "trainer", "recruiter")


def _svc() -> CodingService:
    return current_app.extensions["svc"]


def _db():
    return current_app.extensions["db"]


def _parse(model, payload):
    try:
        return model.model_validate(payload or {})
    except ValidationError as e:
        raise BadRequest("Validation failed", code="validation_error",
                         details=e.errors(include_url=False)) from e


@bp.post("/drive/v1/coding/problems")
@require_roles(*AUTHOR)
def create_problem():
    data = _parse(ProblemIn, request.get_json(silent=True))
    with _db().session() as s:
        p = _svc().create_problem(s, data)
        return created({"id": p.id, "title": p.title,
                        "hidden_case_count": len(p.hidden_cases)})


@bp.post("/drive/v1/coding/session")
def open_session():
    ident = current_identity()
    data = _parse(OpenSessionIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().open_session(s, ident.user_id, data))


@bp.post("/drive/v1/coding/<sid>/save")
def save(sid):
    ident = current_identity()
    data = _parse(SaveIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().save(s, sid, ident.user_id, data.code))


@bp.get("/drive/v1/coding/languages")
def languages():
    # Language version management: which toolchains are available on this host.
    return ok(_svc().languages())


@bp.post("/drive/v1/coding/run-adhoc")
def run_adhoc():
    # Run exam coding answers against their (visible) sample cases — any
    # authenticated candidate. Hidden-case grading happens on exam submit.
    current_identity()
    b = request.get_json(silent=True) or {}
    lang = b.get("language", "python")
    code = b.get("code", "")
    cases = b.get("cases") or []
    if not code.strip():
        raise BadRequest("No code to run", code="empty_code")
    return ok(_svc().run_adhoc(lang, code, cases))


@bp.post("/drive/v1/coding/<sid>/run")
def run(sid):
    ident = current_identity()
    data = _parse(RunIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().run_samples(s, sid, ident.user_id, data.code))


@bp.post("/drive/v1/coding/<sid>/submit")
def submit(sid):
    ident = current_identity()
    data = _parse(RunIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().submit(s, sid, ident.user_id, data.code))


@bp.get("/drive/v1/coding/<sid>/result")
def result(sid):
    current_identity()
    with _db().session() as s:
        return ok(_svc().result(s, sid))
