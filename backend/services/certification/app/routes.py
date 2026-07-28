"""HTTP layer for the Certification Service.

The `/verify/<verify_id>` endpoint is PUBLIC (no auth) — it backs the verifiable
certificate link. Issuance is server-side (triggered by `year.completed`) or by
staff; students read their own certificates.
"""
from __future__ import annotations

from flask import Blueprint, current_app, request
from pydantic import ValidationError

from lare_common.auth_context import current_identity, require_roles
from lare_common.errors import BadRequest, Forbidden, NotFound
from lare_common.file_client import FileClient
from lare_common.responses import created, ok

from .schemas import IssueIn, RevokeIn, TemplateIn
from .service import CertificationService

bp = Blueprint("certification", __name__)

WRITE = ("super_admin", "company_admin")
STAFF = ("super_admin", "company_admin", "college_admin", "trainer")

_FILES = FileClient("lms-certification")


def _svc() -> CertificationService:
    return current_app.extensions["svc"]


def _db():
    return current_app.extensions["db"]


def _parse(model, payload):
    try:
        return model.model_validate(payload or {})
    except ValidationError as e:
        raise BadRequest("Validation failed", code="validation_error",
                         details=e.errors(include_url=False)) from e


@bp.post("/lms/v1/cert-templates")
@require_roles(*WRITE)
def upsert_template():
    data = _parse(TemplateIn, request.get_json(silent=True))
    with _db().session() as s:
        t = _svc().upsert_template(s, data)
        return created({"year_no": t.year_no, "name": t.name, "version": t.version})


@bp.post("/lms/v1/certificates/issue")
@require_roles(*WRITE)
def issue():
    data = _parse(IssueIn, request.get_json(silent=True))
    with _db().session() as s:
        return created(_svc().issue(s, data))


@bp.post("/lms/v1/certificates/issue-typed")
@require_roles(*WRITE)
def issue_typed():
    body = request.get_json(silent=True) or {}
    if not body.get("learner_id") or not body.get("cert_type"):
        raise BadRequest("learner_id and cert_type required", code="missing_fields")
    with _db().session() as s:
        return created(_svc().issue_typed(
            s, body["learner_id"], body["cert_type"],
            body.get("holder_name"), body.get("ref")))


@bp.get("/lms/v1/certificates/<cert_id>/pdf")
def certificate_pdf(cert_id):
    from flask import Response
    with _db().session() as s:
        blob, filename = _svc().certificate_pdf(s, cert_id)
    return Response(blob, mimetype="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={filename}"})


@bp.get("/lms/v1/certificates/for/<learner_id>")
def for_learner(learner_id):
    ident = current_identity()
    if not ident.has_role(*STAFF) and ident.user_id != learner_id:
        raise Forbidden("Not permitted")
    with _db().session() as s:
        return ok(_svc().for_learner(s, learner_id))


@bp.post("/lms/v1/certificates/<cert_id>/revoke")
@require_roles(*WRITE)
def revoke(cert_id):
    ident = current_identity()
    data = _parse(RevokeIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().revoke(s, cert_id, data.reason, ident.user_id))


# Request a File-service upload slot for the signed certificate PDF artifact.
# Real File-service integration: returns a pre-signed upload URL scoped to this
# certificate (purpose=certificate), which the admin/render worker PUTs the PDF to.
@bp.post("/lms/v1/certificates/<cert_id>/artifact-url")
@require_roles(*WRITE)
def artifact_url(cert_id):
    ident = current_identity()
    with _db().session() as s:
        from .models import Certificate
        if not s.get(Certificate, cert_id):
            raise NotFound("Certificate not found", code="cert_not_found")
    slot = _FILES.request_upload(
        owner_user_id=ident.user_id, purpose="certificate",
        mime="application/pdf", size=1_000_000,
        filename=f"{cert_id}.pdf", entity_type="certificate", entity_id=cert_id)
    if not slot:
        raise BadRequest("File service unavailable", code="files_unavailable")
    return created(slot)


# ---- PUBLIC verification (no auth) ----
@bp.get("/verify/<verify_id>")
def verify(verify_id):
    with _db().session() as s:
        return ok(_svc().verify(s, verify_id))
