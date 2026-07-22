# SRS — Institution Service (LMS)

**Service ID:** `lms-institution` · **Domain:** LMS · **Version:** 1.0

---

## 1. Purpose
Manage colleges, their branches, academic years/semesters, cohorts, and the branch-wise rotational schedule that the 4-year programme runs on. It is the organizational backbone that Curriculum, Learner, and Progress services attach to. Encodes the MoU scheduling model: CSE & allied branches in the odd semester, core branches in the even semester, one week per branch, rotational.

## 2. Responsibilities
- Onboard colleges (e.g., Aditya College of Engineering) with MoU metadata, contacts, and timezone.
- Manage branches (CSE, CSE-AI, CSE-AIML, CSE-AIDS/AIMD, ECE, EEE, Civil, Mechanical, …).
- Define academic calendar: years (1–4), semesters (odd/even), terms.
- Create cohorts (branch + year + section) and the rotational training schedule (1 week/branch).
- Assign trainers/mentors and a single college coordinator (TPO) per college.
- Manage minimum cohort size and per-branch/batch variations (per MoU commercials).

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| IN-1 | CRUD colleges with contacts, address, timezone, MoU reference & status. |
| IN-2 | CRUD branches; classify as `cse_allied` or `core` (drives odd/even scheduling). |
| IN-3 | Define academic years/semesters and map to calendar dates. |
| IN-4 | Generate/edit the branch-wise rotational schedule (odd=CSE&allied, even=core), one-week slots, non-overlapping. |
| IN-5 | Create cohorts and enroll them into a programme year track. |
| IN-6 | Assign coordinator (TPO), trainers, and mentors with scope. |
| IN-7 | Configure per-college programme parameters (passing threshold default 60%, cohort min size). |

## 4. Data Model (`lms_institution` schema)
| Table | Key columns |
|-------|-------------|
| `colleges` | id, tenant_id, name, address, timezone, mou_ref, status, coordinator_user_id |
| `branches` | id, college_id, name, code, category(cse_allied/core) |
| `academic_years` | id, college_id, year_no(1..4), start, end |
| `semesters` | id, academic_year_id, type(odd/even), start, end |
| `cohorts` | id, college_id, branch_id, academic_year_id, section, size |
| `schedule_slots` | id, semester_id, branch_id, week_no, module_ref, start, end, trainer_user_id |
| `assignments` | id, college_id, user_id, role(trainer/mentor/coordinator), scope |
| `college_config` | college_id, passing_threshold, min_cohort_size, params |

## 5. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST/GET | `/lms/v1/colleges` | Manage colleges. |
| POST/GET | `/lms/v1/colleges/{id}/branches` | Branches. |
| POST/GET | `/lms/v1/colleges/{id}/calendar` | Years/semesters. |
| POST/GET | `/lms/v1/colleges/{id}/cohorts` | Cohorts. |
| POST/GET | `/lms/v1/colleges/{id}/schedule` | Rotational schedule. |
| POST | `/lms/v1/colleges/{id}/assignments` | Assign staff. |
| GET/PUT | `/lms/v1/colleges/{id}/config` | Programme config. |

## 6. Security
- Super/Company Admin manage colleges; TPO edits own college within limits; trainers read-only on schedule.

## 7. Non-Functional
- Schedule generation validates no branch/slot overlap; supports what-if preview.

## 8. Events
`college.onboarded`, `cohort.created`, `schedule.published` → Curriculum/Progress/Notification/Analytics.

## 9. Deployment (No Docker)
Gunicorn + Nginx; systemd `lms-institution.service`. Schema `lms_institution` in Supabase PostgreSQL.
