# LARE Platform — Master Build Plan (Pending Work)

Durable checklist of everything remaining to reach a complete, working platform.
Legend: `[ ]` pending · `[~]` in progress · `[x]` done. Each service is built to
the same bar as Auth: models → schemas → service → routes → factory → manage/seed
→ smoke test → wired to Gateway → frontend screens.

> DB stays on **SQLite** until final delivery, then we switch every service to the
> **Supabase Postgres** string in one pass (Phase 10). Design doctrine
> (`frontend/DESIGN.md`: Open Design contract + Hallmark anti-slop + UI-UX Pro Max
> rules) applies to every screen.

---

## ✅ Already done (baseline)
- [x] SRS documentation — 28 files (master + 27 service specs)
- [x] `lare_common` shared library (config, db+schema, security, responses, errors, app_factory, auth_context)
- [x] **Auth Service** (register/login/refresh+rotation/logout/me/RBAC) + smoke test
- [x] Frontend foundation (DESIGN.md, tokens, primitives, AppShell, Landing/Login/Register/Dashboard) — builds clean

---

## Phase 0 — Infra foundations (cross-cutting)
- [x] **Event bus** (`lare_common/events.py`): EventBus with redis/http/memory backends, subscription topology, `/events/v1/ingest` webhook, Redis consumer groups. Publishers wired: exam.submitted, assessment.scored, year.completed, certificate.issued, result.published, offer.created, interview.decided. Subscribers: evaluation, progress, gamification, certification, notification (inbox), analytics (facts), audit (hash-chain). **VERIFIED** in-process (full LMS chain) + cross-process (real HTTP ingest).
- [x] **Redis helper** (`lare_common/redis_helper.py`): `get_redis` graceful fallback + `RateLimiter`; gateway rate-limit uses it (Redis or in-memory).
- [x] **Service-token** minting/verification (`lare_common/internal.py`) + `ServiceClient` (`service_client.py`) for east-west auth.
- [x] **LMS→Drive projection** (candidate `import-from-lms/auto` fetches Learner profile) + **File Service integration** (`file_client.py`: résumé validation, cert artifact-url).
- [x] Alembic scaffolding: shared template (`alembic-template/`) + `scaffold-migrations.ps1` + `DEPLOYMENT.md`.
- [x] Orchestration launcher: `run-all.ps1` / `stop-all.ps1` / `health.ps1` / `Procfile` / `services.txt`.
- [x] systemd + Nginx + gunicorn templates (`deploy/`).

## Phase 1 — API Gateway  ✅ done
- [x] Gateway service (JWT verify, strip/inject trusted headers, longest-prefix routing, rate limit, CORS, health aggregation, SSE passthrough)
- [x] Point frontend at Gateway (VITE_API_TARGET → :8000)
- [x] Gateway integration smoke test (7 checks incl. spoof-strip, verified against live Auth)

## Phase 2 — LMS core vertical
- [x] Institution Service (colleges, branches, calendar, cohorts, rotational schedule, config) — smoke test passing (11 checks); routed via Gateway `/lms/v1/colleges…`
- [x] Learner Service (profiles, enrollment, bulk import preview/commit, stream selection, promote, ownership RBAC) — smoke test passing (13 checks)
- [x] Curriculum Service (year tracks, modules, lessons, objectives, outcome checks, publish/immutability, cohort mapping, item mapping) — smoke test passing (15 checks)
- [x] Content Delivery Service (items, prerequisite gating, consumption tracking, playlist, rule-based recommendations, play URL) — smoke test passing (9 checks)
- [x] Progress Tracking Service (attendance %, module progress, skill scorecard w/ averaging, year-completion + `year.completed` signal, ownership RBAC) — smoke test passing (7 checks)
- [ ] Frontend: My Learning, Curriculum, Progress/Scorecard, Admin (Institution/Learner)

> **✅ Phase 2 LMS core backend vertical COMPLETE** — Institution · Learner · Curriculum · Content · Progress, all with passing smoke tests, all routed through the Gateway.

## Phase 3 — LMS assessment & engagement
- [x] Assessment Service (authoring, hidden keys, MCQ/multi auto-grade + negative marking, subjective manual grade, attempts limit, pass/fail, scorecard summary) — smoke test passing (11 checks)
- [x] Gamification Service (idempotent XP ledger, levels, badges, streaks w/ freezes, leaderboards, server-side-only awarding) — smoke test passing (11 checks)
- [x] Certification Service (4-year series templates, idempotent auto-issue, public unguessable verification, PPO tag on Y4, revoke w/ reason) — smoke test passing (10 checks)
- [ ] Frontend: Assessments, Achievements/Leaderboard, Certificates

> **✅ ENTIRE LMS DOMAIN COMPLETE** — 10 backend services (Auth, Gateway + Institution, Learner, Curriculum, Content, Progress, Assessment, Gamification, Certification), all with passing smoke tests, all routed through the Gateway.

## Phase 4 — LMS AI  ✅ built (STUB mode without ANTHROPIC_API_KEY)
- [x] AI Orchestration Service (governed Claude egress, prompt library, structured JSON, usage audit; graceful STUB when no key/SDK) — smoke passing; gateway-routed `/ai/`.
- [x] AI Tutor Service (grounded chat + sessions, study plan, stream advice; reaches model only via Orchestration; degrades offline) — smoke passing. **VERIFIED** tutor→orchestration east-west live.
- [x] Frontend: AI Tutor chat (`Tutor.jsx`), study plan / stream advice quick actions.
- [ ] Live Claude responses — set `ANTHROPIC_API_KEY` + `pip install anthropic` (code path ready, no changes needed).

## Phase 5 — Drive core
- [x] Candidate Service (profile w/ completeness, resume, education/skills/projects, LMS import, drive applications w/ duplicate guard, recruiter view) — smoke test passing (11 checks)
- [x] Recruitment Drive Service (drives, roles, eligibility evaluation, round pipeline, registration, shortlist, advance, funnel, PPO config) — smoke test passing (12 checks)
- [x] Question Bank Service (8 item types, versioning, active-key immutability, bulk import, blueprint paper generation w/ hidden keys + shortfall reporting) — smoke test passing (9 checks)
- [ ] Frontend: Candidate profile, Drives list/apply, Question authoring

> **✅ Phase 5 Drive core COMPLETE** — Candidate · Recruitment Drive · Question Bank.

## Phase 6 — Drive exam engine
- [x] Exam Engine Service (sessions, single-active/resume, server-authoritative timer + auto-submit on timeout, section locking, auto-save, ownership, idempotent submit) — smoke test passing (12 checks)
- [x] Submission Service (durable append-only history, last-write-wins latest, time-spent, immutable final snapshot, idempotent finalize, export for Evaluation/Audit) — smoke test passing (7 checks)
- [x] Anti-Cheating Service (13 proctoring signals, weighted scoring, flag/auto-submit escalation, integrity score, per-session summary + drive integrity report) — smoke test passing (9 checks)
- [x] Coding Assessment Service (problems w/ sample+hidden cases, IDE sessions, run vs samples, submit vs hidden, weighted scoring, timeout handling, executor abstraction w/ dev subprocess + prod OS-sandbox swap, no key leak) — smoke test passing (12 checks, real code execution)
- [ ] Frontend: Exam Portal (timed/sectioned/proctored), Coding IDE

> **✅ Phase 6 Drive exam-engine cluster COMPLETE** — Exam Engine · Submission · Anti-Cheating · Coding.

## Phase 7 — Drive outcome
- [x] Evaluation Service (deterministic auto-grade w/ negative marking, coding-score merge, accuracy, ranking w/ tie-breakers, question difficulty index, re-evaluation versioning) — smoke test passing (11 checks)
- [x] Interview Service (schedule, interviewer allocation, allocated-only competency ratings w/ averaging, select/reject/hold decisions + double-decision guard, dossier, drive listing) — smoke test passing (11 checks)
- [x] Result & Offer Service (compile + rank + outcome, controlled publish w/ elevated role, offer/PPO letter records + public verification, offer lifecycle + double-finalize guard, CSV export) — smoke test passing (11 checks)
- [ ] Frontend: Results, Interview console, Offers

> **✅ ENTIRE DRIVE DOMAIN COMPLETE** — Candidate · Drive · Question Bank · Exam Engine · Submission · Anti-Cheating · Coding · Evaluation · Interview · Result (10 services).

## Phase 8 — Shared cross-cutting services
- [x] Notification Service (versioned templates, variable rendering, pluggable email provider, in-app inbox + read, preference respect + critical override, idempotent dedupe, SMS/WhatsApp adapter-ready) — smoke test passing (10 checks)
- [x] File & Storage Service (pre-signed upload/download, per-purpose mime/size policy, blocked-executable, AV-scan gate, pending→ready lifecycle, ownership+staff authz, storage backend abstraction: local dev / Supabase prod) — smoke test passing (16 checks)
- [x] Analytics Service (append-only fact store, KPI rollups, weighted college readiness index, "best college" ranking, skill scorecard, drive analytics, role dashboards, CSV export, college-scoped RBAC) — smoke test passing (11 checks)
- [x] Audit Service (append-only hash-chained tamper-evident log, activity stream, integrity verification w/ break-point detection, drive integrity export) — smoke test passing (10 checks)
- [ ] Frontend: Notifications inbox, Analytics dashboards, "Best College" ranking

> **✅ Phase 8 shared services COMPLETE** — Notification · File/Storage · Analytics · Audit.
>
> **✅ ALL 24 NON-AI BACKEND SERVICES COMPLETE & VERIFIED** (Auth, Gateway, 8 LMS, 10 Drive, 4 shared). Only the 2 AI services (Phase 4) remain — blocked on ANTHROPIC_API_KEY.

## Phase 9 — Frontend role experiences  ✅
- [x] Role dashboards: Super Admin / College Admin / TPO (`admin/AdminConsole.jsx` — colleges, learner roster, bulk import, verify), Trainer (`admin/TrainerConsole.jsx` — attendance, year-check, subjective grading), Recruiter (existing console).
- [x] Curriculum authoring (`admin/CurriculumStudio.jsx` — curriculum→years→modules→lessons→publish).
- [x] LMS assessment take-flow (`Assessments.jsx`), Certificates + public verify (`Certificates.jsx`), AI Tutor chat (`Tutor.jsx`).
- [x] Real résumé upload (3-step pre-signed File-service flow in `Profile.jsx`).
- [x] Role-aware nav (Administration + Recruiter sections). Build clean (1963 modules).

## Phase 10 — Postgres, hardening, deploy (final)
- [x] Postgres-ready: `Database` uses per-service schema via `search_path`; `run-all.ps1 -DatabaseUrl` switches all services in one pass (awaiting Supabase string).
- [x] Alembic scaffolding + `scaffold-migrations.ps1` (replaces `create_all`).
- [x] RS256 + JWKS: Auth serves `/.well-known/jwks.json`; Gateway verifies RS256 when `JWT_ALG=RS256` + `JWT_PUBLIC_KEY` set.
- [x] Redis rate-limit at Gateway; coding sandbox hardening (nsjail/bwrap, fatal-in-prod fallback); email (SMTP/Brevo) + SMS (Twilio) provider adapters.
- [x] Deploy configs: `deploy/lare@.service`, `gunicorn.conf.py`, `nginx.conf`; `DEPLOYMENT.md` runbook.
- [~] Final switch to live Supabase Postgres + apply migrations — one command once the connection string is provided.

---

## 🎯 Status summary
- **26/26 backend services built & verified** (Auth, Gateway, 8 LMS, 10 Drive, 4 shared, 2 AI). ~290 passing smoke checks.
- **Cross-service event bus** live and verified in-process (full LMS chain: assessment→scorecard→year→certificate→inbox/analytics/audit) **and** cross-process (real HTTP ingest).
- **Frontend**: all student + recruiter + admin/TPO/trainer role experiences; `npm run build` clean (1963 modules).
- **Remaining (all env-gated, no code work):** provide `ANTHROPIC_API_KEY` for live AI; provide Supabase string to switch Postgres + `alembic upgrade head`; install `redis`/`psycopg`/`pyjwt[crypto]`/`bubblewrap` on the prod host.
