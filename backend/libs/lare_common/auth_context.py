"""Request authentication context + RBAC guard usable by every service.

Two supported modes:
  1. Behind the API Gateway: the Gateway verifies the JWT and injects trusted
     headers (X-User-Id, X-Roles, X-Tenant-Id, X-College-Ids). Services trust
     these on the private network.
  2. Direct (dev / service without gateway): decode the Bearer JWT locally.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import wraps

from flask import current_app, g, request

from .errors import Forbidden, Unauthorized
from .security import decode_token


@dataclass
class Identity:
    user_id: str
    roles: list[str] = field(default_factory=list)
    tenant_id: str = "lare"
    college_ids: list[str] = field(default_factory=list)

    def has_role(self, *roles: str) -> bool:
        return any(r in self.roles for r in roles)


def _from_headers() -> Identity | None:
    uid = request.headers.get("X-User-Id")
    if not uid:
        return None
    roles = [r for r in (request.headers.get("X-Roles", "").split(",")) if r]
    colleges = [c for c in (request.headers.get("X-College-Ids", "").split(",")) if c]
    return Identity(
        user_id=uid,
        roles=roles,
        tenant_id=request.headers.get("X-Tenant-Id", "lare"),
        college_ids=colleges,
    )


def _from_bearer() -> Identity | None:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    cfg = current_app.config["LARE"]
    try:
        claims = decode_token(
            auth[7:],
            alg=cfg.JWT_ALG,
            verify_key=cfg.verify_key,
            issuer=cfg.JWT_ISSUER,
            audience=cfg.JWT_AUDIENCE,
        )
    except Exception as exc:  # noqa: BLE001
        raise Unauthorized("Invalid or expired token") from exc
    if claims.get("type") != "access":
        raise Unauthorized("Not an access token")
    return Identity(
        user_id=claims["sub"],
        roles=claims.get("roles", []),
        tenant_id=claims.get("tenant_id", "lare"),
        college_ids=claims.get("college_ids", []),
    )


def current_identity() -> Identity:
    ident = _from_headers() or _from_bearer()
    if ident is None:
        raise Unauthorized("Authentication required")
    g.identity = ident
    return ident


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        current_identity()
        return fn(*args, **kwargs)
    return wrapper


def require_roles(*roles: str):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            ident = current_identity()
            if not ident.has_role(*roles):
                raise Forbidden("Insufficient role")
            return fn(*args, **kwargs)
        return wrapper
    return decorator
