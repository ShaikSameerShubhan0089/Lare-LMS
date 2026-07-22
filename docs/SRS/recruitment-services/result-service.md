# SRS — Result & Offer Service (Drive)

**Service ID:** `drive-result` · **Domain:** Recruitment · **Version:** 1.0

---

## 1. Purpose
Produce and publish final drive results — rank, pass/fail, shortlist — and generate offer letters / PPO letters for selected candidates. Consolidates evaluation scores and interview decisions into a final outcome per candidate, supports report exports (Excel/PDF/CSV), and administers the Pre-Placement Offer conversion for the Lare Consulting and Technologies Pvt. Ltd. pipeline.

## 2. Responsibilities
- Compile final results per drive/round from Evaluation + Interview outcomes.
- Determine pass/fail and shortlist against configured cutoffs.
- Publish results (controlled release) with notifications to candidates + TPO.
- Generate offer letters and PPO letters (templated, signed, verifiable) via File Service.
- Track offer status (issued/accepted/declined) and onboarding status.
- Export result reports (Excel/PDF/CSV) for company + college.
- Feed placement funnel and outcomes to Analytics.

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| RS-1 | Aggregate per-candidate outcome across rounds (scores + decisions). |
| RS-2 | Apply cutoffs → pass/fail + shortlist; support manual overrides (audited). |
| RS-3 | Controlled result publish (draft → review → publish) with MFA on publish. |
| RS-4 | Generate offer/PPO letters from templates; store + verifiable link. |
| RS-5 | Track offer lifecycle (issued/accepted/declined) + onboarding status. |
| RS-6 | Exports (Excel/PDF/CSV) with signed download. |
| RS-7 | Leaderboard/result views scoped by role. |
| RS-8 | PPO conversion: apply conversion criteria from drive `ppo_config`. |

## 4. Data Model (`drive_result` schema)
| Table | Key columns |
|-------|-------------|
| `results` | id, drive_id, candidate_id, final_score, rank, outcome(pass/fail/shortlist), status(draft/published) |
| `offers` | id, drive_id, candidate_id, role_id, type(offer/ppo), letter_file_id, verify_id, status |
| `offer_events` | offer_id, status, ts, actor |
| `onboarding` | candidate_id, offer_id, stage, updated_at |
| `result_exports` | id, drive_id, format, file_id, requested_by |

## 5. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/drive/v1/drives/{id}/results/compile` | Compile results. |
| POST | `/drive/v1/drives/{id}/results/publish` | Publish (MFA). |
| GET | `/drive/v1/drives/{id}/results` | Results (scoped). |
| POST | `/drive/v1/offers/generate` | Generate offer/PPO letters. |
| POST | `/drive/v1/offers/{id}/status` | Update offer status. |
| POST | `/drive/v1/drives/{id}/results/export` | Export report. |
| GET | `/verify/offer/{verifyId}` | Verify offer letter (public). |

## 6. Security
- Publish + offer generation require elevated role + MFA; overrides audited.
- Offer letters signed, verifiable, revocable; candidates see only own outcome.

## 7. Non-Functional
- Compile large cohorts quickly; publish is atomic per drive.
- Letter generation reliable; verification P95 < 200 ms.

## 8. Events
Consumes `evaluation.completed`, `ranks.computed`, `interview.decided`. Publishes `result.published`, `offer.generated`, `offer.accepted` → Notification/Analytics/Audit/Candidate.

## 9. Deployment (No Docker)
Gunicorn + Nginx; systemd `drive-result.service` + letter/export render worker. Schema `drive_result`; letters/exports in Supabase Storage.
