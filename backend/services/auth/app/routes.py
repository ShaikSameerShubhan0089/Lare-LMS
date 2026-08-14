"""HTTP layer for the Auth Service."""
from __future__ import annotations

from flask import Blueprint, current_app, request
from pydantic import ValidationError
from sqlalchemy import select

from lare_common.auth_context import current_identity, require_roles
from lare_common.errors import BadRequest, NotFound, Unauthorized
from lare_common.internal import verify_service_token
from lare_common.responses import created, ok

from .models import User
from .schemas import (
    AssignRoleIn, EmailVerifyIn, LoginIn, OtpRequestIn, OtpVerifyIn,
    PasswordForgotIn, PasswordResetIn, RefreshIn, RegisterIn,
)
from .service import AuthService

bp = Blueprint("auth", __name__)


def _svc() -> AuthService:
    return current_app.extensions["auth_service"]


def _db():
    return current_app.extensions["db"]


def _parse(model, payload):
    try:
        return model.model_validate(payload or {})
    except ValidationError as e:
        raise BadRequest("Validation failed", code="validation_error",
                         details=e.errors(include_url=False)) from e


# Public JWKS for RS256 verification (prod). Empty key set under dev HS256.
@bp.get("/.well-known/jwks.json")
def jwks():
    from lare_common.security import public_jwks
    cfg = current_app.config["LARE"]
    keys = public_jwks(cfg.JWT_PUBLIC_KEY) if cfg.JWT_ALG.startswith("RS") else {"keys": []}
    from flask import jsonify
    return jsonify(keys)


@bp.post("/register")
def register():
    data = _parse(RegisterIn, request.get_json(silent=True))
    with _db().session() as s:
        user = _svc().register(s, data.email, data.password, data.full_name, data.product)
        # Self-registration on a campus platform defaults to the student role.
        _svc().assign_role(s, user.id, "student", None)
        # Issue an email-verification token (delivered via Notification in prod).
        verify_token = _svc().request_email_verification(s, user.id)
        s.flush()
        out = _svc().user_out(s, user)
    _deliver("email_verify", data.email, verify_token)
    resp = {**out}
    if current_app.config["LARE"].DEBUG:
        resp["dev_email_verify_token"] = verify_token
    return created(resp)


def _deliver(purpose: str, to: str, secret: str) -> None:
    """Best-effort out-of-band delivery of a secret via the Notification service.
    Never blocks auth; in dev the token is also returned in the response."""
    try:
        from lare_common.service_client import ServiceClient
        ServiceClient("auth").post("lare-notify", "/notify/v1/send", {
            "user_id": to, "template_key": purpose, "channel": "email",
            "variables": {"email": to, "code": secret, "token": secret},
        })
    except Exception:  # noqa: BLE001
        pass


# ---- OTP (passwordless / step-up) ----
@bp.post("/internal/drive-token")
def drive_token():
    # Internal-only: the Drive candidate service provisions a passwordless student
    # identity and gets platform tokens back. Authenticated by the service token,
    # never publicly reachable (the Gateway has no /auth/v1/internal public route).
    try:
        verify_service_token(request.headers.get("X-Internal-Token", ""))
    except Exception as e:  # noqa: BLE001
        raise Unauthorized("invalid internal token") from e
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip()
    if not email:
        raise BadRequest("email required", code="email_required")
    with _db().session() as s:
        return ok(_svc().mint_drive_token(s, email, body.get("full_name")))


@bp.post("/otp/request")
def otp_request():
    data = _parse(OtpRequestIn, request.get_json(silent=True))
    with _db().session() as s:
        code = _svc().request_otp(s, data.email, data.product)
    if code:
        _deliver("otp", data.email, code)
    resp = {"sent": True}  # uniform response (no user enumeration)
    if code and current_app.config["LARE"].DEBUG:
        resp["dev_code"] = code
    return ok(resp)


@bp.post("/otp/verify")
def otp_verify():
    data = _parse(OtpVerifyIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().verify_otp(s, data.email, data.code, data.device, data.product))


# ---- password reset ----
@bp.post("/password/forgot")
def password_forgot():
    data = _parse(PasswordForgotIn, request.get_json(silent=True))
    with _db().session() as s:
        token = _svc().request_password_reset(s, data.email, data.product)
    if token:
        _deliver("password_reset", data.email, token)
    resp = {"sent": True}
    if token and current_app.config["LARE"].DEBUG:
        resp["dev_reset_token"] = token
    return ok(resp)


@bp.post("/password/reset")
def password_reset():
    data = _parse(PasswordResetIn, request.get_json(silent=True))
    with _db().session() as s:
        _svc().reset_password(s, data.token, data.new_password)
    return ok({"reset": True})


# ---- email verification ----
@bp.post("/email/verify/request")
def email_verify_request():
    ident = current_identity()
    with _db().session() as s:
        token = _svc().request_email_verification(s, ident.user_id)
    resp = {"sent": True}
    if current_app.config["LARE"].DEBUG:
        resp["dev_email_verify_token"] = token
    return ok(resp)


@bp.post("/email/confirm")
def email_confirm():
    data = _parse(EmailVerifyIn, request.get_json(silent=True))
    with _db().session() as s:
        return ok(_svc().verify_email(s, data.token))


@bp.post("/login")
def login():
    data = _parse(LoginIn, request.get_json(silent=True))
    with _db().session() as s:
        tokens = _svc().login(s, data.email, data.password, data.device, data.product)
    return ok(tokens)


@bp.post("/refresh")
def refresh():
    data = _parse(RefreshIn, request.get_json(silent=True))
    with _db().session() as s:
        tokens = _svc().refresh(s, data.refresh_token)
    return ok(tokens)


@bp.post("/logout")
def logout():
    data = _parse(RefreshIn, request.get_json(silent=True))
    with _db().session() as s:
        _svc().logout(s, data.refresh_token)
    return ok({"logged_out": True})


@bp.get("/flags")
def flags():
    # Feature flags (req #30) for the caller's tenant — drives conditional UI.
    from lare_common.platform import all_flags
    ident = current_identity()
    return ok(all_flags(ident.tenant_id))


@bp.get("/me")
def me():
    ident = current_identity()
    with _db().session() as s:
        user = s.get(User, ident.user_id)
        if not user:
            raise NotFound("User not found", code="user_not_found")
        return ok(_svc().user_out(s, user))


@bp.post("/roles/assign")
@require_roles("super_admin", "company_admin")
def assign_role():
    data = _parse(AssignRoleIn, request.get_json(silent=True))
    with _db().session() as s:
        _svc().assign_role(s, data.user_id, data.role, data.college_id)
    return ok({"assigned": True})


@bp.get("/users")
@require_roles("super_admin", "company_admin", "college_admin", "recruiter")
def list_users():
    # `ids=a,b,c` resolves a specific set (used by Drive to label candidates by
    # name/email instead of raw UUIDs); otherwise lists up to `limit`.
    ids = [i for i in (request.args.get("ids", "").split(",")) if i]
    limit = min(int(request.args.get("limit", 50)), 200)
    with _db().session() as s:
        stmt = select(User)
        stmt = stmt.where(User.id.in_(ids)) if ids else stmt.limit(limit)
        rows = s.execute(stmt).scalars().all()
        return ok([_svc().user_out(s, u) for u in rows], meta={"count": len(rows)})
