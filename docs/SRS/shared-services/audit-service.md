# SRS — Audit Service (Shared)

**Service ID:** `lare-audit` · **Domain:** Shared · **Version:** 1.0

---

## 1. Purpose
Tamper-evident, append-only record of every significant action across the platform — logins, exam events, tab-switches, question edits, score changes, offer generation, certificate issuance, AI decisions. Provides the compliance and forensic backbone for both LMS and Drive, and supports dispute resolution and accreditation evidence.

## 2. Responsibilities
- Capture audit events from all services with a canonical envelope.
- Store immutably (append-only; hash-chained for tamper evidence).
- Provide searchable, filterable audit query APIs (admin-only).
- Retain per policy; support legal hold.
- Correlate multi-service actions via `correlation_id`.
- Record AI interactions (model ID, prompt version, decision) for governance.

## 3. Audited Actions (examples)
Candidate logged in · started/submitted exam · changed tab / lost focus / exited fullscreen · copy/paste / right-click · admin updated a question · recruiter changed a score · result published · offer generated · certificate issued · role assigned · file downloaded · AI evaluation produced.

## 4. Functional Requirements
| ID | Requirement |
|----|-------------|
| AD-1 | Accept events via API and via broker; both write the same immutable log. |
| AD-2 | Each record: `id, ts, actor(user/service), action, entity_type, entity_id, before, after, ip, device, correlation_id, hash, prev_hash`. |
| AD-3 | Hash-chain per partition; expose verification endpoint to detect tampering. |
| AD-4 | Records are write-once; no update/delete via API (retention purge is controlled + logged). |
| AD-5 | Query with filters (actor, action, entity, time, correlation) + pagination; admin-only. |
| AD-6 | AI decisions logged with model, prompt version, inputs digest, output digest. |
| AD-7 | Export audit slices (e.g., a drive's integrity log) for evidence. |

## 5. Data Model (`shared_audit` schema)
| Table | Key columns |
|-------|-------------|
| `audit_logs` | id, ts, actor_type, actor_id, action, entity_type, entity_id, meta, ip, device, correlation_id, hash, prev_hash, partition_key |
| `activity_logs` | id, user_id, session_id, event, context, ts (higher-volume UX/proctor stream) |
| `retention_policies` | scope, ttl, legal_hold |

> High-volume proctoring signals (tab-switch, blur) land in `activity_logs`; security/compliance-critical actions land in hash-chained `audit_logs`.

## 6. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/audit/v1/events` (internal) | Ingest audit event. |
| GET | `/audit/v1/logs` | Query (admin). |
| GET | `/audit/v1/logs/verify` | Chain integrity check. |
| GET | `/audit/v1/drive/{id}/integrity` | Drive integrity export. |

## 7. Security
- Write-restricted to services/admins; read restricted to Super/Company Admin + scoped college integrity views.
- Immutability enforced at DB (revoke UPDATE/DELETE; append-only role).
- PII in `meta` minimized; sensitive values hashed.

## 8. Non-Functional
- High write throughput (exam proctoring bursts); batched inserts.
- Retention configurable; legal hold overrides purge.

## 9. Events
Consumes all `*.audit`-relevant events; publishes nothing back (sink).

## 10. Deployment (No Docker)
Gunicorn + Nginx; systemd `lare-audit.service` + ingestion worker. Partitioned append-only tables in Supabase PostgreSQL; nightly integrity job.
