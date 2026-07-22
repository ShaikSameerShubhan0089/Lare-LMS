# SRS — Candidate Service (Drive)

**Service ID:** `drive-candidate` · **Domain:** Recruitment · **Version:** 1.0

---

## 1. Purpose
Own the candidate profile used in recruitment drives: resume, photo, education, CGPA, branch, skills, certifications, and projects. A candidate is the recruitment-facing view of a platform user; when the person is also an LMS learner, the profile is pre-populated from the Learner Service (with consent) so top LMS performers flow seamlessly into the PPO pipeline.

## 2. Responsibilities
- Maintain candidate profiles and portfolios (resume, photo, links).
- Import/sync eligible LMS learners into candidate records (consented projection).
- Track applications to drives and per-drive eligibility snapshots.
- Provide profile completeness and recruiter-facing candidate views.
- Optional AI resume-enhancement suggestions (advisory, via AI Orchestration).

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| CN-1 | CRUD candidate profile linked to `user_id`; pull LMS learner data on consent. |
| CN-2 | Resume/photo upload via File Service (pre-signed, scanned). |
| CN-3 | Manage education, CGPA, branch, skills, certifications, projects. |
| CN-4 | Apply to a drive → creates an application with an eligibility snapshot. |
| CN-5 | Profile completeness score + prompts. |
| CN-6 | Recruiter-facing candidate card (scoped to applied drives only). |
| CN-7 | AI resume suggestions (advisory) on request. |

## 4. Data Model (`drive_candidate` schema)
| Table | Key columns |
|-------|-------------|
| `candidates` | id, user_id, college_id, branch, cgpa, photo_file_id, resume_file_id, completeness |
| `education` | id, candidate_id, degree, institution, year, score |
| `skills` | id, candidate_id, skill, level |
| `projects` | id, candidate_id, title, description, repo_url |
| `applications` | id, candidate_id, drive_id, drive_role_id, status, eligibility_snapshot, applied_at |

## 5. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET/PUT | `/drive/v1/candidate/profile` | Own profile. |
| POST | `/drive/v1/candidate/resume` | Attach resume (file id). |
| POST | `/drive/v1/candidate/import-from-lms` | Consented LMS pull. |
| POST | `/drive/v1/drives/{id}/apply` | Apply to a drive. |
| GET | `/drive/v1/candidates/{id}` | Recruiter view (scoped). |
| POST | `/drive/v1/candidate/resume/suggestions` | AI suggestions. |

## 6. Security
- Candidates edit own profile; recruiters see only candidates on their drives.
- LMS→Drive projection requires learner consent flag.

## 7. Non-Functional
- Profile reads fast; recruiter list views paginated + filterable.

## 8. Events
`candidate.created`, `application.submitted` → Drive/Analytics/Notification.

## 9. Deployment (No Docker)
Gunicorn + Nginx; systemd `drive-candidate.service`. Schema `drive_candidate`.
