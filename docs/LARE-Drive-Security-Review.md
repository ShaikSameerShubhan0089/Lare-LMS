# LARE Drive-OS — Phase 6 Security Review

**Scope:** the five new Drive-OS services — evidence (8027), competency (8028), decision (8029), action (8030), recruit-ai (8031) — and their gateway/east-west wiring. Reviewed against the LARE platform's existing security model (RS256 at the gateway, schema-per-service, `lare_common`).

**Method:** manual review of routes (authZ), schemas (input validation), data model (immutability/PII), cross-service calls (trust), and the raw-SQL hardening step. The end-to-end chain is exercised by `backend/tests/integration_drive_os.py` (13/13), which includes an RBAC-negative check (student blocked).

## Findings

| # | Area | Finding | Severity | Status |
|---|------|---------|----------|--------|
| 1 | Evidence immutability | Ledger is append-only in the app (no update/delete routes) **and** at the DB — a `BEFORE UPDATE/DELETE` trigger + `REVOKE UPDATE, DELETE FROM PUBLIC` (Postgres). | High | **Fixed** |
| 2 | AuthZ — endpoint exposure | Every route on all 5 services is `@require_roles`-gated; none appear in the gateway `PUBLIC_PREFIXES`, so all require a valid RS256 access token. Writes require an elevated role; students are rejected (verified in the integration test). | High | **Verified** |
| 3 | Raw-SQL identifier | `harden.py` interpolates the schema name (from `DB_SCHEMA`) into DDL. Now validated against `^[A-Za-z_][A-Za-z0-9_]*$` before use; ORM handles all other SQL (parameterised). | Medium | **Fixed** |
| 4 | Input validation | All request bodies are Pydantic-validated; `signal` is bounded 0–100, enums constrained (`source_type`, `confidence`, `verdict`). No raw body reaches the DB unvalidated. | Medium | **OK** |
| 5 | East-west trust | Service-to-service calls carry a signed `X-Internal-Token` (HS256, `INTERNAL_JWT_SECRET`). **Action:** production MUST set a strong `INTERNAL_JWT_SECRET` and `JWT_SECRET`/RS256 keys — the dev defaults are insecure by design. | High | **Ops action** |
| 6 | Decision auditability | `decision.made` is published to the event bus; `lare-audit` is a wildcard subscriber and hash-chains events. Decisions therefore reach the audit trail with their coverage/confidence. | Medium | **OK** (verify audit is running) |
| 7 | Multi-tenant isolation | Services scope by `drive_id` but not by company/tenant, so a recruiter who knows another company's drive id could read its data. This mirrors the existing `drive-core` model and is a **platform-wide** concern, not new to these services. | Medium | **Accepted / platform TODO** |
| 8 | Scoring integrity | Coverage/agreement/confidence/calibration are **deterministic** (no LLM), so there is no prompt-injection or model-manipulation surface on the numbers a decision relies on. LLM narration (recruit-ai) only rewrites prose and degrades to `derived`. | Low | **OK** |
| 9 | Rate limiting | New routes inherit the gateway's per-IP rate limiting; no unbounded/fan-out endpoints were added. | Low | **OK** |
| 10 | PII exposure | Services store `candidate_id` only; human-readable names are resolved client-side from registrations. No new PII is persisted in the Drive-OS schemas. | Low | **OK** |

## Required before production
1. Set strong `INTERNAL_JWT_SECRET` and RS256 `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` (finding #5) — never ship the dev defaults.
2. Confirm `lare-audit` is running so `decision.made` is chained (finding #6).
3. Track multi-tenant scoping (finding #7) as a platform-wide hardening item (add a company/tenant claim check to Drive read endpoints).

## Not in scope / deferred
Full pen-test, dependency CVE scan, and TLS/termination config (handled at the ingress/nginx layer, already in `AWS_DEPLOY.md`).
