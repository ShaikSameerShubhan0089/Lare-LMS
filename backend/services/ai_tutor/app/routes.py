"""HTTP layer for the AI Tutor Service. Students use their own identity; a
learner only ever sees their own sessions."""
from __future__ import annotations

from flask import Blueprint, current_app, request
from pydantic import ValidationError

from lare_common.auth_context import current_identity
from lare_common.errors import BadRequest, Forbidden
from lare_common.responses import created, ok

from .schemas import ChatIn, PlanIn
from .service import TutorService

bp = Blueprint("tutor", __name__)


def _svc() -> TutorService:
    return current_app.extensions["svc"]


def _db():
    return current_app.extensions["db"]


def _parse(model, payload):
    try:
        return model.model_validate(payload or {})
    except ValidationError as e:
        raise BadRequest("Validation failed", code="validation_error",
                         details=e.errors(include_url=False)) from e


@bp.post("/ai/v1/tutor/chat")
def chat():
    ident = current_identity()
    data = _parse(ChatIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().chat(s, ident.user_id, data.session_id,
                                   data.message, data.context))


@bp.get("/ai/v1/tutor/sessions")
def sessions():
    ident = current_identity()
    with _db().session() as s:
        return ok(_svc().sessions(s, ident.user_id))


@bp.get("/ai/v1/tutor/sessions/<sid>/messages")
def messages(sid):
    ident = current_identity()
    from .models import TutorSession
    with _db().session() as s:
        sess = s.get(TutorSession, sid)
        if not sess or sess.learner_id != ident.user_id:
            raise Forbidden("Not your session")
        return ok(_svc().messages(s, sid))


@bp.post("/ai/v1/tutor/study-plan")
def study_plan():
    ident = current_identity()
    data = _parse(PlanIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().study_plan(s, ident.user_id, data.variables))


@bp.post("/ai/v1/tutor/stream-advice")
def stream_advice():
    ident = current_identity()
    data = _parse(PlanIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().stream_advice(s, ident.user_id, data.variables))
