# SRS — Learner Service (LMS)

**Service ID:** `lms-learner` · **Domain:** LMS · **Version:** 1.0

---

## 1. Purpose
Own the student learner profile within the LMS: enrollment into cohorts and year tracks, academic details, chosen stream, and the learner-facing identity that Progress, Assessment, Gamification, and Certification build on. The same physical person also has a Drive-side Candidate profile; the two are linked by `user_id`.

## 2. Responsibilities
- Maintain learner profiles (name, roll no, branch, CGPA, contact, photo ref).
- Enroll learners into cohorts/year tracks; handle transfers and status (active/paused/alumni).
- Record stream selection (AI/ML, Data Science, Web, Cybersecurity, Cloud) chosen at end of Year 2.
- Store skills, certifications, projects references for the scorecard/portfolio.
- Support bulk import of student databases by College Admin/TPO.
- Provide learner directory APIs to other LMS services and, on consent, to Drive.

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| LN-1 | CRUD learner profile; link to `user_id` and `cohort_id`. |
| LN-2 | Bulk import (CSV/Excel) with validation, dedupe, and a preview/commit flow. |
| LN-3 | Verify students (TPO action) before programme participation. |
| LN-4 | Capture Year-2 stream selection with source (aptitude + interest survey + mentor counselling). |
| LN-5 | Maintain skills/projects/certifications lists for portfolio & scorecard. |
| LN-6 | Progress a learner year-to-year (Year 1→4) with status history. |
| LN-7 | Expose consented profile projection to Drive/Candidate service. |

## 4. Data Model (`lms_learner` schema)
| Table | Key columns |
|-------|-------------|
| `learners` | id, user_id, college_id, cohort_id, roll_no, branch_id, cgpa, photo_file_id, status |
| `enrollments` | id, learner_id, academic_year_id, year_no, status, started_at |
| `stream_selection` | learner_id, stream, rationale, decided_at, mentor_user_id |
| `skills` | id, learner_id, skill, level, source |
| `projects` | id, learner_id, title, description, repo_url, artifacts |
| `learner_certs` | id, learner_id, cert_ref, year_no |
| `imports` | id, college_id, file_id, status, summary |

## 5. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST/GET | `/lms/v1/learners` | Manage learners. |
| POST | `/lms/v1/learners/import` | Bulk import (preview/commit). |
| POST | `/lms/v1/learners/{id}/verify` | TPO verification. |
| GET/PUT | `/lms/v1/learners/{id}/stream` | Stream selection. |
| GET/POST | `/lms/v1/learners/{id}/projects` | Portfolio projects. |
| GET | `/lms/v1/learners/{id}/profile` | Full learner profile. |

## 6. Security
- TPO/trainers scoped to their college; learners edit limited self-fields.
- Cross-domain projection to Drive requires learner consent flag.

## 7. Non-Functional
- Bulk import handles thousands of rows with row-level error reporting.

## 8. Events
`learner.enrolled`, `learner.verified`, `stream.selected`, `learner.promoted` → Progress/Gamification/Analytics.

## 9. Deployment (No Docker)
Gunicorn + Nginx; systemd `lms-learner.service`. Schema `lms_learner`.
