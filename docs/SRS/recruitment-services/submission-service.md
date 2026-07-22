# SRS — Submission Service (Drive)

**Service ID:** `drive-submission` · **Domain:** Recruitment · **Version:** 1.0
**Criticality:** High (durability guarantees).

---

## 1. Purpose
The durable, append-only system of record for every candidate answer and submission event. It guarantees that no accepted answer is ever lost, captures auto-saves and final submissions with timestamps and time-spent, and provides the authoritative answer data that Evaluation grades. Decoupling storage from the Exam Engine keeps exam sessions fast and submissions safe.

## 2. Responsibilities
- Persist every answer write (auto-save + final) as an append-only record.
- Track time spent per question/section and section completion.
- Provide the final, authoritative answer set per session for Evaluation.
- Support resume by returning the latest answer state per session.
- Guarantee idempotency and ordering; reconcile duplicate/late writes.
- Retain full answer history for audit/dispute.

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| SB-1 | Append-only write of each answer with `(session, question, version, ts, source)`. |
| SB-2 | Auto-save writes ack only after durable persistence. |
| SB-3 | Compute latest answer per question (last-write-wins by version/ts) for resume/eval. |
| SB-4 | Record time spent per question/section and section completion flags. |
| SB-5 | Final submission snapshot is immutable and marks the session submitted. |
| SB-6 | Idempotent by `Idempotency-Key` / `(session, question, client_seq)`. |
| SB-7 | Provide answer export per session/drive for Evaluation and Audit. |

## 4. Data Model (`drive_submission` schema)
| Table | Key columns |
|-------|-------------|
| `answers` | id, exam_session_id, question_id, version, response(json), source(autosave/final), client_seq, ts |
| `answer_latest` | exam_session_id, question_id, response, updated_at (materialized) |
| `time_spent` | exam_session_id, question_id, seconds |
| `section_completion` | exam_session_id, section_id, completed, ts |
| `final_submissions` | id, exam_session_id, snapshot_ref, submitted_at |

## 5. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/drive/v1/submissions/{session}/answer` | Durable answer write (auto-save). |
| POST | `/drive/v1/submissions/{session}/final` | Finalize submission (immutable). |
| GET | `/drive/v1/submissions/{session}/latest` | Latest answers (resume). |
| GET | `/drive/v1/submissions/{session}/export` | Full answer set (Evaluation/Audit). |

## 6. Security
- Only Exam Engine/Coding write; Evaluation/Audit read; candidates never read others' answers.
- Immutable history; final snapshot write-once.

## 7. Non-Functional
- Write ack < 300 ms; zero accepted-write loss (durable before ack).
- Handles high write throughput at drive scale; partitioned by drive/session.

## 8. Events
Consumes `exam.autosaved`, `exam.submitted`, `coding.submitted`. Publishes `submission.finalized` → Evaluation/Audit/Analytics.

## 9. Deployment (No Docker)
Gunicorn + Nginx; systemd `drive-submission.service`. Append-only, partitioned tables in Supabase PostgreSQL; materialized `answer_latest` via triggers/worker.
