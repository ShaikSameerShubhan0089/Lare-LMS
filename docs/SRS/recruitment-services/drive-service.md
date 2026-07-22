# SRS — Recruitment Drive Service (Drive)

**Service ID:** `drive-core` · **Domain:** Recruitment · **Version:** 1.0

---

## 1. Purpose
Orchestrate the full recruitment lifecycle for a drive: company + college linkage, roles/positions, eligibility criteria, schedule/venue, rounds, and status. It is the coordinator that ties Candidate, Exam Engine, Coding, Evaluation, Interview, and Result together, and administers the internship/PPO pipeline with Lare Consulting and Technologies Pvt. Ltd.

## 2. Responsibilities
- Create drives with company, participating colleges, roles/positions, and reporting time/venue.
- Define eligibility criteria (branch, CGPA, backlogs, LMS score, year) and filter candidates.
- Configure the round pipeline (aptitude/technical/verbal → coding → interview → offer).
- Manage drive schedule, capacity, and candidate registration/shortlisting.
- Drive the PPO track: eligibility (e.g., top 10–15% by LMS score + mock + project), selection stages.
- Track drive status and produce the shortlist/offer list handoff to Result.

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| DR-1 | CRUD drive with company, colleges, roles, venue, reporting time, status. |
| DR-2 | Define eligibility rules; auto-evaluate candidate eligibility (incl. LMS score from Analytics). |
| DR-3 | Configure ordered rounds and their linked service (exam/coding/interview). |
| DR-4 | Open registration; shortlist by rule or manually; advance candidates round-to-round. |
| DR-5 | PPO pipeline config (eligibility %, stages, conversion criteria) recorded as MoU addendum data. |
| DR-6 | Compose drive dashboard (funnel, per-round counts). |
| DR-7 | Emit stage transitions to Evaluation/Result/Notification. |

## 4. Data Model (`drive_core` schema)
| Table | Key columns |
|-------|-------------|
| `drives` | id, company_id, title, status, reporting_time, venue, created_by |
| `drive_colleges` | drive_id, college_id |
| `drive_roles` | id, drive_id, title, ctc, positions, description |
| `eligibility_rules` | id, drive_id, rule(json) |
| `rounds` | id, drive_id, order, type(aptitude/technical/verbal/coding/interview), config, service_ref |
| `registrations` | id, drive_id, candidate_id, status |
| `round_progress` | id, registration_id, round_id, status, advanced_at |
| `ppo_config` | drive_id, eligibility, stages, conversion_criteria |

## 5. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST/GET | `/drive/v1/drives` | Manage drives. |
| POST | `/drive/v1/drives/{id}/roles` | Roles/positions. |
| POST | `/drive/v1/drives/{id}/eligibility` | Eligibility rules. |
| POST | `/drive/v1/drives/{id}/rounds` | Round pipeline. |
| POST | `/drive/v1/drives/{id}/shortlist` | Shortlist/advance. |
| GET | `/drive/v1/drives/{id}/funnel` | Drive dashboard. |
| POST | `/drive/v1/drives/{id}/ppo-config` | PPO pipeline config. |

## 6. Security
- Company Admin/recruiters manage their drives; TPO reads own college's participation.
- Eligibility uses authoritative LMS/analytics data; changes audited.

## 7. Non-Functional
- Eligibility evaluation batched for large candidate sets; funnel near-real-time.

## 8. Events
`drive.created`, `drive.registration_opened`, `candidate.shortlisted`, `round.advanced` → all round services/Result/Notification/Analytics.

## 9. Deployment (No Docker)
Gunicorn + Nginx; systemd `drive-core.service`. Schema `drive_core`.
