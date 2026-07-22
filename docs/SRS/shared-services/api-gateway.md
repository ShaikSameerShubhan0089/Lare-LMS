# SRS — API Gateway (Shared)

**Service ID:** `lare-gateway` · **Domain:** Shared · **Version:** 1.0
**Depends on:** Auth Service (JWKS/introspection), all downstream services.

---

## 1. Purpose
Single entry point for every client request into the LARE platform. Terminates the public API surface, verifies identity, enforces coarse authorization and rate limits, routes to the correct microservice, and standardizes cross-cutting concerns (CORS, request IDs, logging, versioning). It keeps individual services thin and consistent.

## 2. Responsibilities
- Expose the public contract `/api/v1/*` and route to internal services.
- Verify JWT access tokens (signature, expiry, issuer, audience) before routing.
- Attach a resolved identity context (`user_id`, `roles`, `tenant_id`, `college_id`) as trusted internal headers.
- Enforce global and per-route rate limits and quotas.
- CORS policy enforcement (env-based allowlist).
- Assign/propagate `X-Request-Id` and `X-Correlation-Id` for tracing.
- API versioning and deprecation headers.
- Request/response size limits; reject oversized uploads (delegate large uploads to File Service pre-signed flow).
- Circuit-breaking and timeouts for downstream calls; graceful 503 with retry hints.
- Centralized structured access logging (feeds Analytics + Audit).

## 3. Out of Scope
- Business logic, data persistence, fine-grained resource authorization (done in each service).
- Token issuance (Auth Service).

## 4. Functional Requirements
| ID | Requirement |
|----|-------------|
| GW-1 | Route table maps `/api/v1/{domain}/{resource}` → internal service base URL. |
| GW-2 | Reject requests without a valid access token except on public allowlist (login, register, health, public college landing). |
| GW-3 | Inject `X-User-Id`, `X-Roles`, `X-Tenant-Id`, `X-College-Id`, `X-Request-Id` to upstream; strip these if present on inbound (anti-spoofing). |
| GW-4 | Enforce per-identity and per-IP rate limits; different tiers for exam endpoints vs general. |
| GW-5 | Support SSE/WebSocket pass-through for exam engine, proctoring, and leaderboards (no buffering, long-lived). |
| GW-6 | Apply request timeout (default 30 s; exam/AI streams excluded) and retry idempotent GETs once. |
| GW-7 | Emit deprecation headers when a route version is sunset. |
| GW-8 | Health aggregation endpoint reporting downstream readiness. |

## 5. Key Endpoints (self)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Gateway liveness. |
| GET | `/ready` | Aggregated downstream readiness. |
| ANY | `/api/v1/{domain}/{*path}` | Proxied route to services. |

## 6. Data
Stateless. Config-driven routing (route table in config/DB-backed with hot reload). Rate-limit counters in Redis. No domain tables.

## 7. Security
- JWT verification via Auth JWKS (cached, rotated).
- Trusted-header injection only after successful verification; inbound spoof headers stripped.
- Rate limiting (Redis token bucket) keyed by identity + IP.
- Optional WAF rules (block common injection/XSS signatures) before routing.
- mTLS or shared-secret to internal services on the private network.

## 8. Non-Functional
- Adds < 15 ms P95 overhead.
- Horizontally scalable (stateless behind Nginx upstream).
- Must not become a single point of failure: ≥ 2 instances.

## 9. Events
Publishes `gateway.request.logged` (sampled) to Analytics; forwards `X-Correlation-Id` end-to-end.

## 10. Deployment (No Docker)
Gunicorn (gevent workers for SSE) behind Nginx; systemd unit `lare-gateway.service`. Route table and rate-limit config from env + Redis. Runs ≥ 2 instances.
