# SRS — Certification Service (LMS)

**Service ID:** `lms-certification` · **Domain:** LMS · **Version:** 1.0

---

## 1. Purpose
Issue, track, and verify the four-year certification series that the MoU promises: **Foundation & Personality Development**, **Programming & Stream Readiness**, **Placement Readiness**, and **Industry Readiness (+ PPO eligibility tag)**. Certificates are auto-generated when Progress signals a year's completion criteria are met, and are independently verifiable.

## 2. Responsibilities
- Define certificate templates per year (branding, fields, signatories).
- Auto-issue on `year.completed` (criteria + passing threshold met, default 60%).
- Render certificates (PDF) and store via File Service with verifiable links.
- Maintain a public verification endpoint (unguessable ID → validity + holder + issue date).
- Apply the PPO eligibility tag on the Year 4 certificate for qualifying students.
- Support revocation and re-issue with reason and audit trail.
- Provide TPO/college certificate registers for NAAC/NBA documentation.

## 3. Certification Series (from MoU)
| Year | Certificate | Trigger |
|------|-------------|---------|
| 1 | Foundation & Personality Development | Year-1 criteria met |
| 2 | Programming & Stream Readiness | Year-2 criteria met |
| 3 | Placement Readiness | Year-3 criteria met |
| 4 | Industry Readiness (+ PPO eligibility tag) | Year-4 criteria met + top-performer rule |

## 4. Functional Requirements
| ID | Requirement |
|----|-------------|
| CE-1 | Template CRUD with variables and signatory config. |
| CE-2 | Auto-issue on `year.completed`; idempotent per (learner, year). |
| CE-3 | Render PDF, store, and produce a verifiable, revocable public URL. |
| CE-4 | Verification endpoint returns validity, holder, cert type, issue date. |
| CE-5 | Apply PPO eligibility tag on Year-4 cert per criteria (top LMS score + mock + project quality). |
| CE-6 | Revoke/re-issue with reason; both logged to Audit. |
| CE-7 | College certificate register + export for accreditation. |

## 5. Data Model (`lms_certification` schema)
| Table | Key columns |
|-------|-------------|
| `templates` | id, year_no, name, layout, signatories, version |
| `certificates` | id, learner_id, year_no, template_id, cert_no, file_id, verify_id, status, issued_at, ppo_tag |
| `revocations` | certificate_id, reason, revoked_by, ts |

## 6. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST/GET | `/lms/v1/cert-templates` | Manage templates. |
| GET | `/lms/v1/learners/{id}/certificates` | Learner certs. |
| POST | `/lms/v1/certificates/{id}/revoke` | Revoke. |
| GET | `/verify/{verifyId}` | Public verification (unauthenticated). |
| GET | `/lms/v1/colleges/{id}/cert-register` | College register/export. |

## 7. Security
- Issuance is server-side from trusted `year.completed` events only.
- Verification link is unguessable + revocable; no PII beyond name/cert type/date.

## 8. Non-Functional
- Auto-issue within minutes of criteria being met; verification P95 < 200 ms.

## 9. Events
Consumes `year.completed`, `scorecard.updated`. Publishes `certificate.issued`, `certificate.revoked` → Notification/Analytics/Drive (PPO eligibility signal).

## 10. Deployment (No Docker)
Gunicorn + Nginx; systemd `lms-certification.service` + PDF render worker. Schema `lms_certification`; PDFs in Supabase Storage.
