# SRS — Curriculum Service (LMS)

**Service ID:** `lms-curriculum` · **Domain:** LMS · **Version:** 1.0

---

## 1. Purpose
Model the 4-year structured curriculum as data: year goals, modules, lessons, domain-relevant tracks, and outcome checks. Encodes the programme from the MoU — Year 1 (Foundation & Personality), Year 2 (Technical Foundation & Stream Discovery), Year 3 (Placement Readiness & Specialisation), Year 4 (Industry Readiness & Capstone) — plus branch-specific tracks for core branches.

## 2. Responsibilities
- Define year-wise curriculum trees: Year → Module → Lesson → Learning Objectives.
- Encode domain tracks: CSE/allied (technical-leaning), ECE/EEE (embedded/IoT/Python), Civil/Mechanical (CAD-adjacent, data analysis), common tracks (aptitude/NQT, resume, LinkedIn).
- Attach outcome checks per year (the MoU "Outcome Check" statements) as measurable criteria.
- Version curricula; map curriculum to cohorts and schedule slots (via Institution).
- Tag content and assessments to objectives (used by AI recommendation & scorecard).

## 3. Year Map (from MoU)
| Year | Theme | Sample modules |
|------|-------|----------------|
| 1 | Foundation & Personality | UHV, communication, JAM/extempore, leadership, digital literacy, logical thinking |
| 2 | Technical Foundation & Stream Discovery | one language (Python/Java/C), DSA basics, DBMS/SQL, Git, aptitude, stream taster + selection |
| 3 | Placement Readiness & Specialisation | company exam patterns (TCS NQT/Infosys/Wipro/Cognizant/Accenture), advanced stream, mock interviews, HR/STAR, resume, GD |
| 4 | Industry Readiness & Capstone | full-stack, capstone, Agile/Scrum, deployment/CI/CD basics, hackathons, internships/PPO, mentor sessions |

## 4. Functional Requirements
| ID | Requirement |
|----|-------------|
| CU-1 | CRUD curriculum tree (year→module→lesson→objective), versioned. |
| CU-2 | Branch-track variants: swap/override modules for core branches. |
| CU-3 | Define per-year outcome checks with measurable pass criteria. |
| CU-4 | Map curriculum versions to cohorts; effective-dated. |
| CU-5 | Tag content/assessment items to objectives (many-to-many). |
| CU-6 | Publish/lock a curriculum version; changes create a new version. |

## 5. Data Model (`lms_curriculum` schema)
| Table | Key columns |
|-------|-------------|
| `curricula` | id, name, version, status |
| `year_tracks` | id, curriculum_id, year_no, theme, goal |
| `modules` | id, year_track_id, title, order, branch_scope(all/cse_allied/core/branch_code) |
| `lessons` | id, module_id, title, order, content_ref |
| `objectives` | id, lesson_id, statement, skill_tag |
| `outcome_checks` | id, year_track_id, statement, criteria |
| `cohort_curriculum` | cohort_id, curriculum_id, effective_from |
| `item_objective_map` | objective_id, item_type(content/assessment), item_id |

## 6. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST/GET | `/lms/v1/curricula` | Manage curricula/versions. |
| GET | `/lms/v1/curricula/{id}/tree` | Full tree. |
| POST | `/lms/v1/curricula/{id}/publish` | Lock version. |
| POST | `/lms/v1/cohorts/{id}/curriculum` | Map to cohort. |
| GET | `/lms/v1/objectives/{id}/items` | Linked content/assessments. |

## 7. Security
- Company Admin/curriculum designers edit; trainers/TPO read; students read published tree only.

## 8. Non-Functional
- Versioning immutable; published versions never mutated in place.

## 9. Events
`curriculum.published`, `curriculum.mapped` → Content/Progress/Assessment/Analytics.

## 10. Deployment (No Docker)
Gunicorn + Nginx; systemd `lms-curriculum.service`. Schema `lms_curriculum`.
