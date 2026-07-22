# SRS — Progress Tracking Service (LMS)

**Service ID:** `lms-progress` · **Domain:** LMS · **Version:** 1.0

---

## 1. Purpose
The LMS "system of record" for learner progress: attendance, module completion, assessment outcomes, and the composite **skill scorecard** (communication, coding, aptitude, project). It is the data the MoU's LMS tracking, year-wise certification triggers, and "best college" analytics depend on. Consolidates events from Content, Assessment, Coding, Interview, and Attendance into a per-student, per-year picture.

## 2. Responsibilities
- Track attendance per module/slot (integrating with college attendance in coordination with LMS).
- Aggregate module/content completion and assessment scores.
- Maintain the per-student skill scorecard dashboard data.
- Evaluate year-wise completion criteria and signal Certification when met.
- Provide per-learner, per-cohort, per-college progress read models.
- Feed Analytics with normalized progress facts.

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| PR-1 | Record attendance (present/absent/late) per schedule slot; import + LMS-linked tracking. |
| PR-2 | Aggregate content completion % per module/year. |
| PR-3 | Ingest assessment/coding/interview scores into the scorecard dimensions. |
| PR-4 | Compute year completion vs criteria (attendance + scores + specific items); default threshold 60%. |
| PR-5 | Signal `year.completed` to Certification when criteria met. |
| PR-6 | Expose skill scorecard (communication, coding, aptitude, project) with history/trend. |
| PR-7 | Provide cohort/college roll-ups to Analytics. |

## 4. Skill Scorecard Dimensions
| Dimension | Fed by |
|-----------|--------|
| Communication | JAM/extempore, GD, HR mock (Assessment/Interview) |
| Coding | Coding tests, capstone (Assessment/Coding) |
| Aptitude | Aptitude/NQT-pattern tests (Assessment) |
| Project | Capstone/hackathon/projects (Assessment/Learner) |

## 5. Data Model (`lms_progress` schema)
| Table | Key columns |
|-------|-------------|
| `attendance` | id, learner_id, schedule_slot_id, status, ts |
| `module_progress` | id, learner_id, module_id, completion_pct, updated_at |
| `scorecard` | learner_id, year_no, communication, coding, aptitude, project, updated_at |
| `score_events` | id, learner_id, dimension, value, source, ref_id, ts |
| `year_status` | learner_id, year_no, criteria_met, computed_at |

## 6. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/lms/v1/attendance` | Mark/import attendance. |
| GET | `/lms/v1/learners/{id}/progress` | Progress summary. |
| GET | `/lms/v1/learners/{id}/scorecard` | Skill scorecard + trend. |
| GET | `/lms/v1/cohorts/{id}/progress` | Cohort roll-up. |
| GET | `/lms/v1/learners/{id}/year/{n}/status` | Year completion status. |

## 7. Security
- Learners see own progress; trainers/TPO scoped to cohort/college.

## 8. Non-Functional
- Idempotent event ingestion; scorecard recompute incremental and consistent.

## 9. Events
Consumes `content.completed`, `assessment.scored`, `coding.scored`, `interview.rated`, attendance events. Publishes `year.completed`, `scorecard.updated` → Certification/Gamification/Analytics.

## 10. Deployment (No Docker)
Gunicorn + Nginx; systemd `lms-progress.service` + ingestion worker. Schema `lms_progress`.
