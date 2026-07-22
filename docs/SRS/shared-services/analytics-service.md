# SRS — Analytics Service (Shared)

**Service ID:** `lare-analytics` · **Domain:** Shared · **Version:** 1.0

---

## 1. Purpose
Turn platform events and domain data into dashboards, scorecards, and the **"best college"** ranking. Serves both LMS analytics (learning readiness, skill growth) and Drive analytics (attendance, scores, difficulty, top performers), plus NAAC/NBA-ready reports.

## 2. Responsibilities
- Ingest domain events into an append-only event store + build read models (materialized views / denormalized reporting schema).
- Compute KPIs: enrollment, attendance, average scores, section analysis, question difficulty, branch-wise & college-wise stats, top performers, placement funnel.
- Skill scorecard aggregation (communication, coding, aptitude, project) per student.
- **College readiness index** and comparative college ranking ("best college").
- Trend analysis (year-on-year cohort progress) and drill-down.
- Export to Excel/CSV/PDF (via File Service) for accreditation.
- Optional AI-generated narrative summaries of dashboards (via AI Orchestration).

## 3. KPI Catalog (selection)
| KPI | Grain | Source |
|-----|-------|--------|
| Attendance % | student, module, cohort, college | Progress |
| Avg assessment score | cohort, branch, college | Assessment/Evaluation |
| Section-wise accuracy | drive, section | Exam/Evaluation |
| Question difficulty index | question | Submission/Evaluation |
| Skill scorecard | student | Assessment + Coding + Interview |
| Placement funnel (applied→shortlisted→offered) | drive, college | Drive/Result |
| Certification completion | cohort, year | Certification |
| College readiness index | college | composite |
| Engagement (XP, streaks) | student, cohort | Gamification |

## 4. Functional Requirements
| ID | Requirement |
|----|-------------|
| AN-1 | Event ingestion is idempotent and ordered per aggregate. |
| AN-2 | Dashboards for each role (Super Admin, Company, TPO, Trainer, Recruiter) with scoped data. |
| AN-3 | Configurable "college readiness index" formula (weighted composite), versioned. |
| AN-4 | College comparison/ranking view with filters (branch, year, drive). |
| AN-5 | Scheduled + on-demand exports (Excel/CSV/PDF) with signed download. |
| AN-6 | Time-range, cohort, branch, and drive filters on every report. |
| AN-7 | Data freshness ≤ 5 min for near-real-time tiles; nightly for heavy aggregates. |

## 5. Data Model (`shared_analytics` schema)
| Table/View | Purpose |
|------------|---------|
| `events_raw` | append-only ingested events |
| `fact_assessment` | grain: student×assessment |
| `fact_exam_section` | grain: candidate×drive×section |
| `fact_attendance` | grain: student×module |
| `dim_student`, `dim_college`, `dim_drive`, `dim_question` | dimensions |
| `mv_college_readiness` | materialized composite index |
| `mv_skill_scorecard` | per-student skills |
| `report_jobs` | export job status |

## 6. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/v1/dashboard/{role}` | Role dashboard payload. |
| GET | `/analytics/v1/college/{id}/readiness` | Readiness index + breakdown. |
| GET | `/analytics/v1/colleges/ranking` | "Best college" ranking. |
| GET | `/analytics/v1/scorecard/{studentId}` | Skill scorecard. |
| GET | `/analytics/v1/drive/{id}` | Drive analytics. |
| POST | `/analytics/v1/reports/export` | Generate export job. |
| GET | `/analytics/v1/reports/{jobId}` | Export status/link. |

## 7. Security
- Strict scope enforcement: a TPO sees only their college; a recruiter only their drives.
- Aggregates avoid exposing PII where not authorized.

## 8. Non-Functional
- Read-optimized; heavy queries hit read models, not OLTP tables.
- Handles millions of events; incremental refresh.

## 9. Events
Consumes `*.*` (subscribed set); publishes `report.generated`.

## 10. Deployment (No Docker)
Flask API (Gunicorn) + ingestion/aggregation worker (`lare-analytics-worker.service`) + scheduled refresh (cron/systemd timer). Materialized views in Supabase PostgreSQL.
