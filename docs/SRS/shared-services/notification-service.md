# SRS — Notification Service (Shared)

**Service ID:** `lare-notify` · **Domain:** Shared · **Version:** 1.0
**Consumers:** all services (event-driven).

---

## 1. Purpose
Deliver transactional and engagement notifications across channels. Email is the v1 channel (SMTP/Brevo); SMS and WhatsApp are designed-for and pluggable. Consumes domain events and renders templated, localized messages with delivery tracking.

## 2. Responsibilities
- Subscribe to platform events and map them to notifications.
- Template management (versioned, variables, locale) and rendering.
- Multi-channel dispatch with per-user channel preferences and quiet hours.
- Delivery tracking (queued/sent/delivered/failed/bounced) and retries with backoff.
- Digest/batching (e.g., weekly progress summary, leaderboard recap).
- Suppression list (bounces, unsubscribes) and compliance footers.

## 3. Notification Catalog (examples)
| Trigger event | Channel | Audience |
|---------------|---------|----------|
| `user.registered` | Email | Student/Admin |
| `exam.scheduled` / reminder T-24h/T-1h | Email | Candidate |
| `exam.anticheat.flagged` | Email | Admin/Proctor |
| `result.published` | Email | Candidate + TPO |
| `interview.scheduled` | Email | Candidate + Interviewer |
| `offer.generated` | Email | Candidate |
| `certificate.issued` | Email | Student + TPO |
| `gamification.level_up` / `badge.earned` | Email/In-app | Student |
| `progress.weekly_digest` | Email (digest) | Student + TPO |

## 4. Functional Requirements
| ID | Requirement |
|----|-------------|
| NT-1 | Consume events via broker (Redis Streams) with at-least-once semantics + dedupe key. |
| NT-2 | Render templates with locale + variables; missing-variable safe-fail. |
| NT-3 | Respect user channel preferences and unsubscribe (non-critical only; security/exam mails are mandatory). |
| NT-4 | Retry transient failures (exponential backoff, max N); dead-letter on exhaustion. |
| NT-5 | In-app notification feed API for the frontend bell/inbox. |
| NT-6 | Idempotent send by `(event_id, template, channel)`. |
| NT-7 | Provider abstraction: SMTP, Brevo API; SMS/WhatsApp adapters stubbed. |

## 5. Data Model (`shared_notify` schema)
| Table | Key columns |
|-------|-------------|
| `templates` | id, key, channel, locale, subject, body, version, active |
| `notifications` | id, user_id, template_key, channel, payload, status, dedupe_key, created_at, sent_at |
| `delivery_events` | id, notification_id, status, provider_ref, detail, ts |
| `preferences` | user_id, channel, enabled, quiet_hours |
| `suppressions` | email/phone, reason, ts |
| `inapp_feed` | id, user_id, type, title, body, read_at, created_at |

## 6. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/notify/v1/inbox` | In-app feed for current user. |
| POST | `/notify/v1/inbox/{id}/read` | Mark read. |
| GET/PUT | `/notify/v1/preferences` | Channel prefs. |
| POST | `/notify/v1/templates` (admin) | Manage templates. |
| POST | `/notify/v1/send` (internal) | Direct send (service-to-service). |

## 7. Security
- Only internal services and admins may create sends/templates.
- PII minimized in payloads; storage encrypted; unsubscribe honored.

## 8. Non-Functional
- Non-blocking (async workers); a slow provider never blocks the emitting service.
- Delivery attempt within 60 s for real-time triggers.

## 9. Events
Consumes many; publishes `notification.sent` / `notification.failed` → Analytics/Audit.

## 10. Deployment (No Docker)
Flask API (Gunicorn) + a separate systemd worker process consuming Redis Streams. `lare-notify.service` + `lare-notify-worker.service`. Provider creds in secret store.
