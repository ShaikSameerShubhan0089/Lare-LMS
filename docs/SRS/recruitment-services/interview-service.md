# SRS — Interview Service (Drive)

**Service ID:** `drive-interview` · **Domain:** Recruitment · **Version:** 1.0

---

## 1. Purpose
Manage the human rounds of a drive: scheduling interviews, allocating panels/interviewers, capturing ratings and remarks, and recording selection decisions. Supports technical, HR, and PPO-selection rounds (internal technical + HR rounds conducted by Lare Consulting and Technologies Pvt. Ltd.), and feeds decisions into Result and the skill scorecard (communication dimension).

## 2. Responsibilities
- Schedule interviews (slots, mode: in-person/online link, duration).
- Allocate candidates to interviewers/panels; avoid conflicts and balance load.
- Provide interviewers a candidate view (profile, resume, exam/coding results — scoped).
- Capture structured ratings (per competency), remarks, and a recommendation.
- Record decision (select/reject/hold/next-round) with reasons.
- Track interview status through the pipeline; notify participants.
- Optional AI interview-question suggestions for panels (advisory).

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| IV-1 | Create interview schedules with slots/capacity and mode (link for online). |
| IV-2 | Panel/interviewer allocation with conflict + load checks. |
| IV-3 | Interviewer console: scoped candidate dossier + evaluation form. |
| IV-4 | Structured rating rubric (technical, communication, problem-solving, culture) + remarks. |
| IV-5 | Recommendation + decision capture with reason and audit. |
| IV-6 | Multi-round support (technical → HR → PPO stages). |
| IV-7 | Notifications to candidate + interviewer (schedule, reminders, outcome). |
| IV-8 | AI question suggestions (`interview.question_suggest`) per role/stream. |

## 4. Data Model (`drive_interview` schema)
| Table | Key columns |
|-------|-------------|
| `interviews` | id, drive_id, round_id, candidate_id, mode, link, slot, status |
| `panels` | id, drive_id, name |
| `panel_members` | panel_id, interviewer_user_id |
| `allocations` | interview_id, panel_id/interviewer_user_id |
| `ratings` | id, interview_id, interviewer_user_id, competency, score, remark |
| `decisions` | interview_id, decision, reason, decided_by, ts |

## 5. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/drive/v1/interviews/schedule` | Create schedule/slots. |
| POST | `/drive/v1/interviews/{id}/allocate` | Assign panel/interviewer. |
| GET | `/drive/v1/interviews/{id}/dossier` | Scoped candidate dossier. |
| POST | `/drive/v1/interviews/{id}/rate` | Submit ratings/remarks. |
| POST | `/drive/v1/interviews/{id}/decision` | Record decision. |
| GET | `/drive/v1/interviews/{id}/questions` | AI suggestions. |

## 6. Security
- Interviewers see only assigned candidates + scoped results; decisions audited.
- Candidate contact/PII exposure minimized to what the round needs.

## 7. Non-Functional
- Scheduling handles large cohorts; no double-booking; timezone-correct.

## 8. Events
Consumes `candidate.shortlisted`, `evaluation.completed`. Publishes `interview.scheduled`, `interview.rated`, `interview.decided` → Result/Progress(comm scorecard)/Notification/Analytics.

## 9. Deployment (No Docker)
Gunicorn + Nginx; systemd `drive-interview.service`. Schema `drive_interview`.
