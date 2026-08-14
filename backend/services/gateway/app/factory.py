"""API Gateway app: verify identity, strip spoofed headers, inject trusted
context, rate-limit, and reverse-proxy to the resolved upstream service."""
from __future__ import annotations

import requests
from flask import Flask, g, jsonify, request
from flask_cors import CORS

from lare_common.errors import register_error_handlers
from lare_common.responses import error_payload
from lare_common.security import decode_token

from .config import GatewayConfig
from .proxy import forward
from .ratelimit import RateLimiter
from .routing import Router


def build_app() -> Flask:
    cfg = GatewayConfig()
    app = Flask(cfg.SERVICE_NAME)
    app.config["LARE"] = cfg
    CORS(app, origins=cfg.CORS_ORIGINS, supports_credentials=True)
    register_error_handlers(app)

    router = Router(cfg)
    limiter = RateLimiter()

    def _client_key() -> str:
        ident = getattr(g, "identity_claims", None)
        if ident:
            return f"user:{ident['sub']}"
        return f"ip:{request.headers.get('X-Forwarded-For', request.remote_addr)}"

    @app.get("/health")
    def health():
        return jsonify({"service": cfg.SERVICE_NAME, "status": "ok"})

    @app.get("/ready")
    def ready():
        # Aggregate upstream readiness (best-effort, short timeout).
        results = {}
        for key, base in cfg.UPSTREAMS.items():
            try:
                r = requests.get(base.rstrip("/") + "/health", timeout=1.5)
                results[key] = r.ok
            except requests.RequestException:
                results[key] = False
        return jsonify({"service": cfg.SERVICE_NAME, "upstreams": results})

    @app.route("/<path:path>", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    def gateway(path: str):
        full = "/" + path

        # Resolve upstream first (unknown route -> 404 without leaking topology).
        upstream = router.resolve(full)
        if upstream is None:
            return jsonify(error_payload("route_not_found", "Unknown route")), 404

        # Rate limit (exam paths get a higher ceiling).
        limit = cfg.EXAM_RATE_LIMIT_PER_MIN if "/exam" in full else cfg.RATE_LIMIT_PER_MIN

        injected: dict[str, str] = {}
        if not router.is_public(full):
            # Verify the access token (offline). Dev = HS256; prod = RS256/JWKS.
            auth = request.headers.get("Authorization", "")
            if not auth.startswith("Bearer "):
                return jsonify(error_payload("unauthorized", "Authentication required")), 401
            try:
                claims = decode_token(
                    auth[7:],
                    alg=cfg.JWT_ALG,
                    verify_key=cfg.verify_key,
                    issuer=cfg.JWT_ISSUER,
                    audience=cfg.JWT_AUDIENCE,
                )
            except Exception:  # noqa: BLE001
                return jsonify(error_payload("unauthorized", "Invalid or expired token")), 401
            if claims.get("type") != "access":
                return jsonify(error_payload("unauthorized", "Not an access token")), 401

            # Product isolation: a LARE Learn session may reach only /lms/* (+ the
            # shared platform routes); a LARE Hire session only /drive/*. The two
            # are separate accounts, so a token minted for one product must not act
            # in the other. Tokens issued before this rollout have no product claim
            # — those are allowed through (they age out as users re-log in).
            needed_product = ("learn" if full.startswith("/lms/")
                              else "hire" if full.startswith("/drive/") else None)
            token_product = claims.get("product")
            if needed_product and token_product and token_product != needed_product:
                return jsonify(error_payload(
                    "wrong_product",
                    "This account cannot access the other product")), 403

            g.identity_claims = claims
            injected = {
                "X-User-Id": claims["sub"],
                "X-Roles": ",".join(claims.get("roles", [])),
                "X-Tenant-Id": claims.get("tenant_id", "lare"),
                "X-College-Ids": ",".join(claims.get("college_ids", [])),
                "X-Product": token_product or "",
            }

        if not limiter.allow(_client_key(), limit):
            return jsonify(error_payload("rate_limited", "Too many requests")), 429

        # Always attach a request id for tracing.
        rid = request.headers.get("X-Request-Id") or g.get("request_id", "")
        if rid:
            injected["X-Request-Id"] = rid

        timeout = cfg.PROXY_TIMEOUT
        if any(full.startswith(p) for p in cfg.SLOW_ROUTES):
            timeout = cfg.SLOW_TIMEOUT
        try:
            return forward(upstream, full, injected=injected, timeout=timeout)
        except requests.Timeout:
            return jsonify(error_payload("upstream_timeout", "Upstream timed out")), 504
        except requests.ConnectionError:
            return jsonify(error_payload("upstream_unavailable", "Service unavailable")), 503

    @app.after_request
    def _hdrs(resp):
        resp.headers["X-Service"] = cfg.SERVICE_NAME
        return resp

    return app
