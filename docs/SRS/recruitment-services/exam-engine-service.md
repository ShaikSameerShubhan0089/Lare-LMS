# SRS — Exam Engine Service (Drive)

**Service ID:** `drive-exam-engine` · **Domain:** Recruitment · **Version:** 1.0
**Criticality:** Core / highest.

---

## 1. Purpose
The heart of the recruitment platform: delivers timed, sectioned, proctored online assessments at scale. Manages exam sessions, per-section timers, question serving with randomization, auto-save, resume-after-disconnect, section locking, negative marking, and auto-submission. Works with Anti-Cheating (proctoring signals), Question Bank (items), Submission (durable answers), and Coding (programming sections).

## 2. Responsibilities
- Start/resume exam sessions bound to a candidate + drive round.
- Serve randomized questions per section without leaking answer keys.
- Enforce overall and per-section timers; lock completed sections.
- Auto-save answers continuously and on every change; support resume.
- Apply negative marking rules; enforce navigation rules (linear/free).
- Auto-submit on timeout, on repeated integrity violations, or on manual submit.
- Coordinate with Anti-Cheating (heartbeats, violation-driven actions) and Coding (embedded programming section).

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| EE-1 | `POST /exam/start` creates/loads a session; enforces window + eligibility. |
| EE-2 | Serve section questions (randomized order/pool); options without correctness flags. |
| EE-3 | Per-section + overall countdown enforced server-side (client clock untrusted). |
| EE-4 | Auto-save every ≤10 s and on each answer change; writes go to Submission (durable). |
| EE-5 | Resume session after client crash/network loss to exact state (answers + remaining time). |
| EE-6 | Lock a section on completion/time-up; prevent re-entry per config. |
| EE-7 | Negative marking + partial credit config per section. |
| EE-8 | Auto-submit on timeout / integrity threshold / manual; finalize once (idempotent). |
| EE-9 | Real-time exam events over WebSocket/SSE (timer sync, warnings, forced submit). |
| EE-10 | Integrate coding section: hand off to Coding service, receive scored result. |

## 4. Data Model (`drive_exam` schema)
| Table | Key columns |
|-------|-------------|
| `exams` | id, drive_id, round_id, title, sections, total_time, negative_marking, nav_rule, window_start/end |
| `exam_sections` | id, exam_id, title, order, time_limit, blueprint_ref |
| `exam_questions` | id, exam_session_id, section_id, question_id, order (materialized per session) |
| `exam_sessions` | id, exam_id, candidate_id, status, started_at, remaining_time, section_state, submitted_at |
| `section_state` | session_id, section_id, status, remaining, locked |

> Answers themselves are owned by the **Submission Service** (durable, append-only). The Exam Engine holds session/timing state.

## 5. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/drive/v1/exam/start` | Start/resume session. |
| GET | `/drive/v1/exam/{session}/questions` | Current section questions (no keys). |
| POST | `/drive/v1/exam/{session}/save` | Auto-save answer(s). |
| POST | `/drive/v1/exam/{session}/section/{id}/lock` | Lock/submit section. |
| POST | `/drive/v1/exam/{session}/submit` | Final submit. |
| GET | `/drive/v1/exam/{session}/state` | Resume state. |
| WS | `/drive/v1/exam/{session}/live` | Timer sync + warnings + forced submit. |

## 6. Security
- Server authoritative on time; questions served without keys.
- Session bound to candidate + device fingerprint; single active session enforced (with Anti-Cheating).
- All saves durable (Submission) before ack; final submit idempotent via `Idempotency-Key`.

## 7. Non-Functional
- ≥ 5,000 concurrent sessions per drive; zero accepted-answer loss.
- Auto-save ack < 300 ms; resume restores exact state.
- Horizontal scale (stateless workers; session state in Postgres + Redis).

## 8. Events
Consumes `paper.generated`, `anticheat.action`. Publishes `exam.started`, `exam.autosaved`, `exam.submitted` → Submission/Evaluation/Anti-Cheating/Analytics/Audit.

## 9. Deployment (No Docker)
Gunicorn (gevent/uvicorn workers for WS/SSE) + Nginx (WebSocket upgrade) + systemd `drive-exam-engine.service`. Redis for live timers/session cache; schema `drive_exam`. Run multiple instances behind Nginx upstream for concurrency.
