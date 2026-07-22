# SRS — Coding Assessment Service (Drive)

**Service ID:** `drive-coding` · **Domain:** Recruitment · **Version:** 1.0

---

## 1. Purpose
Provide the online coding IDE and sandboxed code-execution engine for programming and SQL rounds. Candidates write and run code against sample test cases; on submission, code is executed against hidden test cases within time/memory limits and scored. Also serves LMS coding practice. Integrates with Exam Engine (embedded coding sections), Evaluation (scoring), and AI Orchestration (hints, plagiarism/AI-authorship signals).

## 2. Responsibilities
- Serve a browser IDE with syntax highlighting and multi-language support.
- Execute code securely in an isolated sandbox with strict time/memory/CPU limits.
- Run sample (visible) and hidden test cases; return pass/fail per case.
- Score submissions (weighted by test cases) and hand results to Evaluation.
- Store code artifacts (via File Service) for review and integrity checks.
- Provide non-solution AI hints and complexity/style feedback (LMS practice mode).
- Produce plagiarism / AI-authorship advisory signals for Evaluation.

## 3. Supported Languages
Python · Java · C++ · JavaScript (extensible; SQL execution for SQL items).

## 4. Functional Requirements
| ID | Requirement |
|----|-------------|
| CO-1 | IDE session bound to candidate + question; autosave draft code. |
| CO-2 | "Run" executes against sample cases only; returns stdout/stderr + case results. |
| CO-3 | "Submit" executes against hidden cases; enforce time/memory/CPU limits per case. |
| CO-4 | Sandbox isolation: no network, no filesystem escape, resource-capped, killed on limit breach. |
| CO-5 | Deterministic scoring: weighted test-case pass ratio + optional style/complexity. |
| CO-6 | SQL items: run candidate query against a fixture DB; compare result sets. |
| CO-7 | Store final code artifact; expose to Evaluation/reviewers only. |
| CO-8 | AI hint (non-solution) + plagiarism/AI-authorship signal (advisory). |
| CO-9 | Return scored result to Exam Engine/Evaluation with per-case detail. |

## 5. Data Model (`drive_coding` schema)
| Table | Key columns |
|-------|-------------|
| `coding_sessions` | id, exam_session_id, candidate_id, question_id, language, draft_ref, status |
| `runs` | id, coding_session_id, kind(run/submit), stdout, stderr, exit, duration_ms, memory_kb, ts |
| `case_results` | id, run_id, testcase_id, passed, time_ms, memory_kb |
| `coding_submissions` | id, coding_session_id, code_file_id, score, cases_passed, total_cases, submitted_at |
| `integrity_signals` | coding_submission_id, similarity, ai_authorship, detail |

> Hidden test cases live with the Question Bank's testcase sets and are never exposed to the client.

## 6. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/drive/v1/coding/session` | Open IDE session. |
| POST | `/drive/v1/coding/{session}/save` | Autosave code. |
| POST | `/drive/v1/coding/{session}/run` | Run vs sample cases. |
| POST | `/drive/v1/coding/{session}/submit` | Submit vs hidden cases → score. |
| GET | `/drive/v1/coding/{session}/result` | Scored result. |
| POST | `/drive/v1/coding/{session}/hint` | AI hint (practice/allowed). |

## 7. Security
- Execution sandbox strictly isolated (no network, capped resources, ephemeral); untrusted code never touches host.
- Hidden cases + expected outputs never sent to client.
- Rate-limit runs to prevent sandbox abuse; queue + backpressure under load.

## 8. Non-Functional
- Run feedback < 5 s typical; submit scoring bounded by case limits.
- Scales with a pool of execution workers behind a job queue.
- Zero submission loss; final code artifact durable.

## 9. Events
Consumes coding-section handoff from Exam Engine. Publishes `coding.submitted`, `coding.scored` → Exam Engine/Evaluation/Analytics/Audit.

## 10. Deployment (No Docker)
> **No Docker constraint:** sandboxing uses OS-level isolation instead of containers — dedicated low-privilege Linux users + `nsjail`/`bubblewrap` (namespaces, seccomp, cgroups) or `firejail`, with per-run cgroup CPU/memory caps, no-network namespaces, read-only rootfs bind, and hard timeouts. Execution runs on a pool of worker hosts consuming a Redis job queue.
> Gunicorn + Nginx for the API (`drive-coding.service`); separate `drive-coding-executor.service` workers run the sandboxed jobs. Schema `drive_coding`; code artifacts in Supabase Storage.
