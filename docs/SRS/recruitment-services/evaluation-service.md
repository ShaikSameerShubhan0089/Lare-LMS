# SRS — Evaluation Service (Drive)

**Service ID:** `drive-evaluation` · **Domain:** Recruitment · **Version:** 1.0

---

## 1. Purpose
Automatically evaluate submissions and produce scores, percentages, ranks, and accuracy. Grades objective items (MCQ/multi-select/etc.) against answer keys, incorporates Coding service scores, evaluates SQL result sets, applies negative marking, and hands results to the Result service. Optionally uses AI Orchestration for advisory subjective scoring and integrity signals — always human-confirmable for high-stakes outcomes.

## 2. Responsibilities
- Grade objective questions using Question Bank keys (with negative marking/partial credit).
- Aggregate coding scores from the Coding service.
- Compute per-section and total scores, percentages, and accuracy.
- Rank candidates within a drive/round (dense/standard ranking, tie-breakers).
- Feed question difficulty index back to Question Bank/Analytics.
- Advisory AI scoring for subjective items + integrity signals (human-confirmed).
- Produce evaluation records for the Result service and skill scorecard (LMS link).

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| EV-1 | Pull final answers (Submission) + keys (Question Bank) and auto-grade objective items. |
| EV-2 | Apply negative marking, partial credit, section weights per exam config. |
| EV-3 | Merge coding/SQL scores from Coding service. |
| EV-4 | Compute total, percentage, accuracy, and section breakdowns. |
| EV-5 | Rank candidates with configurable tie-breakers (accuracy, time, section priority). |
| EV-6 | Emit difficulty stats per question to Question Bank/Analytics. |
| EV-7 | AI-assisted subjective scoring (advisory) with reviewer confirmation. |
| EV-8 | Re-evaluation on key correction with full audit + versioned results. |

## 4. Data Model (`drive_evaluation` schema)
| Table | Key columns |
|-------|-------------|
| `evaluations` | id, exam_session_id, drive_id, round_id, total, percentage, accuracy, status, version |
| `section_scores` | evaluation_id, section_id, score, max, accuracy |
| `question_scores` | evaluation_id, question_id, awarded, max, correct |
| `ranks` | drive_id, round_id, candidate_id, rank, tie_break |
| `ai_reviews` | evaluation_id, question_id, ai_score, rationale, confirmed_by |

## 5. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/drive/v1/evaluations/run` | Evaluate a session/round (or batch). |
| GET | `/drive/v1/evaluations/{sessionId}` | Evaluation detail. |
| GET | `/drive/v1/drives/{id}/rounds/{rid}/ranks` | Ranking. |
| POST | `/drive/v1/evaluations/{id}/reevaluate` | Re-evaluate (key fix). |
| POST | `/drive/v1/ai-reviews/{id}/confirm` | Confirm/override AI subjective score. |

## 6. Security
- Grading is deterministic and server-side; keys never exposed to clients.
- AI scores advisory; high-stakes confirmation by reviewer; all changes audited/versioned.

## 7. Non-Functional
- Batch evaluate thousands of sessions quickly (worker pool).
- Deterministic, reproducible scoring; re-eval preserves prior versions.

## 8. Events
Consumes `submission.finalized`, `coding.scored`. Publishes `evaluation.completed`, `ranks.computed` → Result/Analytics/Progress(LMS scorecard)/Audit.

## 9. Deployment (No Docker)
Gunicorn + Nginx (API) + `drive-evaluation-worker.service` for batch grading. Schema `drive_evaluation`.
