# SRS — Assessment Service (LMS)

**Service ID:** `lms-assessment` · **Domain:** LMS · **Version:** 1.0

---

## 1. Purpose
Deliver and grade **in-programme** assessments that drive year-wise certification and the skill scorecard: quizzes, aptitude tests, JAM/extempore & communication rubrics, UHV quizzes (Year 1), coding/aptitude tests (Year 2), NQT-pattern & mock-interview scoring (Year 3), capstone/hackathon evaluation (Year 4). Distinct from the Drive **Exam Engine** (high-stakes recruitment exams) — this service is formative/summative learning assessment, though it reuses Question Bank items where useful.

## 2. Responsibilities
- Author and deliver assessments bound to curriculum objectives.
- Support objective (auto-graded) and subjective (rubric + AI-assisted, human-confirmed) items.
- Compute per-year assessment inputs feeding Certification triggers and the scorecard.
- Manage attempts, timing, and retakes per policy.
- Rubric management for communication/JAM/extempore and project/capstone evaluation.
- Route subjective scoring drafts through AI Orchestration (`assess.subjective_score`, `assess.feedback`).

## 3. Year-wise Assessment Basis (from MoU)
| Year | Assessment basis | Certificate trigger |
|------|------------------|---------------------|
| 1 | Attendance + JAM/extempore + UHV quiz | Foundation & Personality Development |
| 2 | Coding test + aptitude test + stream-selection assessment | Programming & Stream Readiness |
| 3 | Mock interview + resume/profile audit + NQT-pattern test | Placement Readiness |
| 4 | Capstone eval + hackathon/demo + internship performance | Industry Readiness (+ PPO tag) |

## 4. Functional Requirements
| ID | Requirement |
|----|-------------|
| AS-1 | Author assessments (objective/subjective/rubric) tied to objectives + year. |
| AS-2 | Auto-grade MCQ/objective; support negative marking & partial credit. |
| AS-3 | Rubric scoring for communication/JAM/extempore and capstone/hackathon. |
| AS-4 | AI-assisted subjective scoring (advisory) with trainer confirmation before it counts. |
| AS-5 | Enforce attempt limits, timing, and passing threshold (default 60%). |
| AS-6 | Emit per-year scored inputs to Progress/Certification/Analytics. |
| AS-7 | Generate personalized feedback (AI) attached to attempts. |

## 5. Data Model (`lms_assessment` schema)
| Table | Key columns |
|-------|-------------|
| `assessments` | id, year_no, type, objectives, time_limit, attempts_allowed, passing_pct |
| `assessment_items` | id, assessment_id, item_type, question_ref, rubric_id, weight |
| `rubrics` | id, name, criteria(json), scale |
| `attempts` | id, assessment_id, learner_id, started_at, submitted_at, status |
| `answers` | id, attempt_id, item_id, response, auto_score, ai_score, final_score, grader_user_id |
| `feedback` | id, attempt_id, text, source(ai/trainer) |

## 6. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST/GET | `/lms/v1/assessments` | Manage assessments. |
| POST | `/lms/v1/assessments/{id}/attempts` | Start attempt. |
| POST | `/lms/v1/attempts/{id}/submit` | Submit. |
| POST | `/lms/v1/answers/{id}/grade` | Trainer confirm/override (incl. AI draft). |
| GET | `/lms/v1/learners/{id}/assessment-summary` | Year inputs for scorecard. |

## 7. Security
- Trainers author/grade within their college/cohort; students attempt within policy.
- AI scores are drafts; final score requires human confirmation for subjective/high-stakes.

## 8. Non-Functional
- Auto-grade instant; AI draft < 8 s; attempts durable (auto-save).

## 9. Events
`assessment.submitted`, `assessment.scored` → Progress/Certification/Gamification/Analytics.

## 10. Deployment (No Docker)
Gunicorn + Nginx; systemd `lms-assessment.service`. Schema `lms_assessment`.
