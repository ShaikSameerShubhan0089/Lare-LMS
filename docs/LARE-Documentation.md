---
title: "LARE Platform — Complete Project Documentation"
subtitle: "LARE Learn (LMS) & LARE Hire (Drive) — Architecture, Design, and Feature Reference"
author: "LARE Cloud Solutions — a unit of LARE Consulting & Technology Pvt. Ltd."
date: "2026"
lang: en
toc: true
toc-depth: 3
numbersections: true
geometry: margin=1in
---

\newpage

# 1. Executive Summary

**LARE** is a single, cloud‑hosted platform that carries a person from *learning a skill* to *being hired for it*. It is delivered as **two products that share one backend**:

- **LARE Learn** (the LMS) — an AI‑assisted learning environment that teaches, tests, and certifies skills. It builds a live model of each learner (the *Cognitive Twin*), auto‑generates lesson material and coding practice, coaches the learner toward their weak areas, and issues verifiable credentials.
- **LARE Hire** (the Drive/recruitment product) — a proctored, skills‑first assessment and hiring suite. Recruiters build question banks and exams, run campus/company drives with anti‑cheat proctoring, evaluate and rank candidates, conduct structured interviews, and issue offers.

The two products are **intentionally separate in the user experience** (a student never sees the recruiter console and vice‑versa) but **share a common platform**: the same identity system, the same 26 backend microservices, the same design system, and the same PostgreSQL database (with an isolated schema per service).

This document is the complete engineering and product reference for the platform. It explains:

- **What the products are** and the problems they solve.
- **The three‑tier architecture** (presentation, application, data) and how requests flow.
- **The backend**: all 26 microservices + the API gateway, the schema‑per‑service data model, and the event bus.
- **The API architecture**: conventions, the JSON envelope, RS256 JWT authentication, gateway routing, and the full endpoint catalogue.
- **The frontend architecture**: the React/Vite single‑page app, routing, the API client, the design system, and shared components.
- **Every page and every major control** across both products (43 screens).
- **UML models**: use‑case, sequence, class, component, and deployment diagrams.
- **Security, deployment, operations, and the roadmap.**

\newpage

# 2. The Problem We Are Overcoming

Skilling and hiring are broken at the seams where they should connect. The specific problems LARE targets:

## 2.1 For learners
1. **One‑size‑fits‑all courses.** Traditional LMS platforms serve the same content to everyone regardless of what a learner already knows or struggles with. LARE builds a **Cognitive Twin** — a per‑learner skill profile derived from real assessment and coding performance — and adapts content, practice, and coaching to it.
2. **Passive video consumption ≠ skill.** Watching lectures does not build coding or aptitude ability. LARE emphasises **active practice**: coding practice with instant feedback, adaptive drills that tune difficulty in real time, and "practice worlds" (workplace simulations).
3. **No trustworthy proof of skill.** A certificate that cannot be verified is worthless to an employer. LARE issues **cryptographically signed credentials** (the Sovereign Learning Wallet) and public verification pages.
4. **Forgetting.** Skills decay. LARE's **spaced‑reinforcement** ("Keep Sharp") schedules review of exactly the topics a learner is about to forget.

## 2.2 For colleges / institutions
1. **Tool sprawl.** Separate tools for content, assessments, coding labs, certificates, and placement. LARE unifies them.
2. **No live visibility.** Administrators cannot see, at a glance, how a cohort is performing or where the weak spots are. LARE provides **live analytics** (rankings, cohort readiness, weak‑area heatmaps).
3. **Exam integrity.** Online assessments are easy to cheat. LARE adds **proctoring and anti‑cheat flags on every page where a student submits an answer**.
4. **The placement gap.** Learning and hiring are disconnected. LARE Hire is built into the same platform, so a college's learners flow directly into recruiter pipelines.

## 2.3 For startups / recruiters
1. **Resume‑based hiring is noisy.** Resumes over‑ and under‑state ability. LARE Hire evaluates **demonstrated skill** through proctored assessments and coding rounds.
2. **Slow test authoring.** Building fair question banks and papers is slow. LARE **AI‑generates** questions and coding problems with hidden test cases.
3. **Cheating at scale.** Remote assessment invites cheating. LARE's proctoring, anti‑cheat event capture, and **adversarial viva** (prove you understand your own solution) make scores trustworthy.
4. **Unstructured interviews.** LARE provides structured interview scheduling, rating, and automated evaluation/ranking.

## 2.4 The unifying thesis
> **Teach a skill, measure it honestly, prove it verifiably, and connect it to an opportunity — on one platform.**

\newpage

# 3. Product Overview

## 3.1 LARE Learn (LMS)

LARE Learn is the student‑facing learning product. Its capabilities:

| Capability | What it does |
|---|---|
| **Dashboard** | A personalised home showing the learner's real XP, level, streak, badges, and skill scorecard. |
| **My Learning** | The curriculum tree (years → modules → lessons) and a personalised content playlist. |
| **Assessments** | Take quizzes/tests; results feed the Cognitive Twin and skill scorecard. Proctored where configured. |
| **Coding Practice** | A student‑facing coding surface using the same sandbox as Drive coding rounds; feeds the Skill Map. |
| **Adaptive Drill** | A "flow" experience: questions whose difficulty tunes in real time to keep the learner in the zone. |
| **Practice Worlds** | Browser‑based workplace simulations (embodied practice). |
| **My Skill Map** | The Cognitive Twin visualised — strengths and gaps across skills. |
| **Career Readiness** | Skills‑to‑opportunity: readiness against target career roles. |
| **Keep Sharp** | Forgetting‑aware spaced review queue. |
| **Peer Mesh** | AI‑matched peer teach‑back — learn by teaching a classmate a step behind. |
| **Micro‑Lessons** | On‑demand, AI‑generated lesson material (text, code, tables, callouts, checks). |
| **AI Tutor** | A conversational tutor for DSA, aptitude, interviews, and study‑plan generation. |
| **Achievements** | XP, badges, streaks, and the leaderboard. |
| **Certificates** | View, print, download (PDF), and publicly verify issued certificates. |
| **My Wallet** | The Sovereign Learning Wallet — a signed, verifiable competence record. |
| **Profile / Settings / Notifications** | Account, preferences, and in‑app inbox. |

**Staff‑facing (within LARE Learn):**

| Console | Purpose |
|---|---|
| **Admin Console** | Colleges, learners, cohorts, and admin analytics. |
| **Curriculum Studio** | Author real curriculum + AI‑assisted lesson material. |
| **Trainer Console** | Roster, attendance, grading, and progress. |

## 3.2 LARE Hire (Drive)

LARE Hire is the recruiter/placement product. Its capabilities:

| Capability | What it does |
|---|---|
| **Drives** (candidate) | Browse and attend open drives; take exams. |
| **Matched Opportunities** | Open drives matched to a candidate's verified skills. |
| **Exam Portal** | The proctored exam‑taking experience (MCQ + coding). |
| **Recruiter Drives** | Create and manage drives (roles, eligibility, rounds, workflow). |
| **Drive Console** | Per‑drive command centre: registrations, rounds, results, interviews, analytics. |
| **Question Bank** | Author/activate questions; AI‑generate questions; build blueprints and papers. |
| **Rounds** | Round‑by‑round marks sheets; advance cleared candidates; export marks. |
| **Results** | Compile, rank, publish results; generate offers/PPOs. |
| **Interviews** | Schedule, allocate, rate, and decide interviews. |
| **Analytics** | Score distribution, coding stats, and one‑click Excel export. |

## 3.3 What we developed (delivery status)

The platform is a **complete, working application** (not a prototype). Delivered across the build:

- 26 backend microservices + gateway, running against managed PostgreSQL (RDS).
- The full React/Vite SPA serving both products with role‑based routing.
- The Cognitive Twin (assessment + coding fusion), AI Tutor, AI micro‑lesson generation, adaptive drill, practice worlds, peer mesh, spaced review, and the signed wallet.
- Proctoring/anti‑cheat hooks, coding sandbox execution, certificate issue/verify, and the recruiter drive pipeline end‑to‑end.
- A 30‑student demo dataset spanning every feature, and admin analytics.
- End‑to‑end AWS deployment (Nginx + systemd/process model + RDS + TLS).

\newpage

# 4. System Architecture (Three-Tier)

LARE is a classic **three-tier architecture**, chosen so each layer scales and is secured independently.

```
                          Internet (HTTPS/TLS)
                                  |
        +-------------------------------------------------+
 TIER 1 |  PRESENTATION                                    |
        |  React + Vite SPA  -  LARE Learn + LARE Hire     |
        |  Served by Nginx (static dist) + TLS termination |
        +----------------------------+--------------------+
                                     |  /api/... (reverse proxy)
        +----------------------------+--------------------+
 TIER 2 |  APPLICATION                                     |
        |  API Gateway (:8000) - auth + longest-prefix     |
        |  26 Flask microservices (127.0.0.1:8001..8026)   |
        |  AI Orchestration -> Gemini / Mistral            |
        |  Event bus (HTTP fan-out or Redis Streams)       |
        +----------------------------+--------------------+
                                     |  SQL (TLS)
        +----------------------------+--------------------+
 TIER 3 |  DATA                                            |
        |  PostgreSQL (Amazon RDS) - schema per service    |
        |  File/object storage - automated backups + PITR  |
        +-------------------------------------------------+
```

Mermaid (renders on GitHub / markdown viewers):

```mermaid
flowchart TB
  U["Browser: Students, Recruiters, Admins"]
  subgraph T1["Tier 1 - Presentation"]
    SPA["React + Vite SPA"]
    NG["Nginx (static + TLS + reverse proxy)"]
  end
  subgraph T2["Tier 2 - Application"]
    GW["API Gateway :8000"]
    SVC["26 Flask microservices"]
    AI["AI Orchestration -> Gemini / Mistral"]
    BUS["Event bus (HTTP / Redis Streams)"]
  end
  subgraph T3["Tier 3 - Data"]
    DB["PostgreSQL (RDS) - schema per service"]
    FS["File / object storage"]
  end
  U --> NG --> SPA
  SPA -->|"/api/..."| GW --> SVC
  SVC --> AI
  SVC <--> BUS
  SVC --> DB
  SVC --> FS
```

## 4.1 Why three tiers
- **Presentation** owns nothing but rendering and user interaction; it holds no secrets and talks only to `/api`.
- **Application** owns all business logic and is the only tier that touches data. It is horizontally scalable and stateless (session state lives in signed tokens, not the process).
- **Data** is a managed, backed-up store with strict network isolation (reachable only from the application tier's security group).

## 4.2 Request flow (happy path)
1. The browser loads the SPA from Nginx over HTTPS.
2. The SPA calls `/api/<service>/v1/...`; Nginx reverse-proxies `/api` to the **gateway** on `127.0.0.1:8000`.
3. The gateway **verifies the JWT**, then routes by **longest-prefix match** to the owning service (e.g. `/lms/v1/gamification/...` to the gamification service on `:8008`).
4. The service executes logic against **its own schema** in PostgreSQL, optionally emits domain events on the bus, and returns a JSON envelope.
5. Nginx streams the response back to the SPA.

## 4.3 Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, React Router v6, Tailwind CSS, Framer Motion, lucide-react icons |
| API client | Fetch-based client with a `{ data, meta, errors }` envelope, JWT storage, silent refresh |
| Backend | Python 3, Flask, SQLAlchemy 2.x, Pydantic v2, Gunicorn |
| Shared library | `lare_common` (config, db, auth context, errors, events, exports, AI client) |
| Datastore | PostgreSQL 16 (Amazon RDS), schema-per-service |
| Event bus | Redis Streams (or HTTP fan-out when Redis is absent) |
| AI | Google Gemini (LARE Learn), Mistral (LARE Hire) via a common AI client |
| Auth | RS256 JWT (Auth signs; every service + gateway verify) |
| Sandbox | Subprocess or bubblewrap isolation for code execution |
| Web/serve | Nginx (static + TLS + reverse proxy); services as processes/systemd units |
| Infra | AWS EC2 + RDS; Elastic IP; Certbot TLS |

## 4.4 Deployment topology

```
DNS --- A record --- Elastic IP
                         |
                     [ EC2 ]
                     Nginx :443/:80
                       |-- / (static dist)  -> /var/www/lare
                       +-- /api -> Gateway :8000 -> services :8001..8026
                                                        |
                                                  RDS PostgreSQL :5432
```

\newpage

# 5. Backend Architecture - Microservices

The backend is **26 Flask microservices plus a gateway**. Each service:

- Owns a **single domain** and a **single PostgreSQL schema** (schema name = service name; `auth` uses `lare_auth` because `auth` is reserved).
- Is started independently (`manage.py serve`) on its own port (`8001..8026`; gateway on `8000`).
- Shares the `lare_common` library for config, database sessions, auth-context extraction, error handling, events, and document exports.
- Returns the standard JSON envelope and honours RS256 JWT verification.

## 5.1 The API Gateway (:8000)

The gateway is the single entry point. Responsibilities:

- **Authentication** - verify the RS256 JWT on protected routes; allow public prefixes (e.g. `/verify/`, auth endpoints).
- **Routing** - longest-prefix match from a `ROUTES` table to the owning service, then reverse-proxy.
- **Slow routes** - AI and code-execution endpoints are given extended timeouts (`SLOW_ROUTES`).
- **Binary passthrough** - streams PDFs and XLSX exports without mangling.

## 5.2 Service catalogue

| # | Service | Port | Domain | Responsibility |
|---|---|---|---|---|
| 1 | **auth** | 8001 | Identity | Registration, login, JWT issue/refresh, OTP, email verify, password reset, `/me`. |
| 2 | **institution** | 8002 | Identity | Colleges, cohorts, and institutional structure. |
| 3 | **learner** | 8003 | Learn | Learner profiles, enrolments, projects, skills, stream selection, imports. |
| 4 | **curriculum** | 8004 | Learn | Curricula, years, modules, lessons; lesson content authoring. |
| 5 | **content** | 8005 | Learn | Content items, personalised playlists, recommendations, content progress. |
| 6 | **progress** | 8006 | Learn | Attendance, year computation, scorecards, progress summaries. |
| 7 | **assessment** | 8007 | Learn | Assessments/attempts, the Cognitive Twin, AI coach, careers, reviews, mesh, drill, worlds, micro-lessons, wallet (the hub service). |
| 8 | **gamification** | 8008 | Learn | XP, levels, badges, streaks, leaderboard. |
| 9 | **certification** | 8009 | Learn | Certificate issue, PDF, and public verification. |
| 10 | **candidate** | 8010 | Hire | Candidate profiles, applications, resume/photo. |
| 11 | **drive** | 8011 | Hire | Drives, roles, eligibility, rounds, workflow, registrations, funnel, exports. |
| 12 | **questionbank** | 8012 | Hire | Questions, blueprints, paper generation. |
| 13 | **exam** | 8013 | Hire | Exam definitions, papers, exam sessions, save/submit. |
| 14 | **submission** | 8014 | Hire | Answer submissions and grading intake. |
| 15 | **anticheat** | 8015 | Hire | Proctoring sessions and anti-cheat event capture. |
| 16 | **coding** | 8016 | Both | Coding problems, sessions, sandbox run/submit, viva, skills aggregation. |
| 17 | **evaluation** | 8017 | Hire | Ranking, difficulty analysis, the Hire evaluation twin. |
| 18 | **interview** | 8018 | Hire | Interview scheduling, allocation, rating, decisions. |
| 19 | **result** | 8019 | Hire | Result compilation, publication, offers/PPOs. |
| 20 | **notification** | 8020 | Platform | In-app inbox, email/SMS dispatch, preferences. |
| 21 | **files** | 8021 | Platform | Pre-signed upload (request, PUT, complete), file metadata. |
| 22 | **analytics** | 8022 | Platform | Role dashboards, college rankings, readiness indices. |
| 23 | **audit** | 8023 | Platform | Append-only audit trail of significant actions. |
| 24 | **ai_orchestration** | 8024 | Platform | Central AI request orchestration and budgeting. |
| 25 | **ai_tutor** | 8025 | Platform | Conversational tutor, sessions, study-plan and advice generation. |
| 26 | **organization** | 8026 | Platform | Organisation/tenant metadata. |
| - | **gateway** | 8000 | Infra | Auth + routing + reverse proxy (front door). |

## 5.3 Schema-per-service data model

Each service `create_all`s its own tables inside its own schema. This gives:

- **Isolation** - a bug or migration in one service cannot corrupt another's tables.
- **Least privilege** - a service connects with `search_path` set to its schema.
- **Independent evolution** - new tables/columns are added per service.

Representative tables (not exhaustive):

- **lare_auth**: users, sessions/refresh tokens, OTP, email-verification, password-reset tokens.
- **assessment**: `assessments`, `assessment_items`, attempts, `skill_profile` (twin), `study_plans`, `career_roles`, `review_items`, `wallet_credentials`, `drill_sessions`, `teach_sessions`, `generated_lessons`, `practice_worlds`, `world_runs`.
- **coding**: `problems`, `coding_sessions`, `coding_vivas`.
- **curriculum**: curricula, years, modules, `lessons` (with a JSON `content` block list).
- **gamification**: learner XP/level/badge/streak records; leaderboard view.
- **drive**: `drives`, `drive_roles` (with `skills`), eligibility, rounds, registrations.
- **certification**: certificates with a readable `verify_id` (e.g. `LARE-VER-####`).

## 5.4 The event bus

Services communicate asynchronously through domain events (e.g. "badge earned", "certificate issued", "exam submitted"). The bus backend is **Redis Streams** when `REDIS_URL` is set, otherwise a synchronous **HTTP fan-out**. This decouples producers from consumers - e.g. earning a badge can trigger a notification without the gamification service knowing about email.

\newpage

# 6. Data Model (Conceptual ER)

Because every service owns its own schema, the "database" is a federation of per-service models joined logically by identifiers (learner id, candidate id, drive id) rather than by cross-schema foreign keys. The conceptual relationships:

```mermaid
erDiagram
  USER ||--o| LEARNER : "is (LMS)"
  USER ||--o| CANDIDATE : "is (Hire)"
  COLLEGE ||--o{ COHORT : has
  COLLEGE ||--o{ LEARNER : enrolls
  CURRICULUM ||--o{ YEAR : contains
  YEAR ||--o{ MODULE : contains
  MODULE ||--o{ LESSON : contains
  LEARNER ||--o{ ATTEMPT : takes
  ASSESSMENT ||--o{ ATTEMPT : "assessed by"
  LEARNER ||--|| SKILL_PROFILE : "has twin"
  LEARNER ||--o{ REVIEW_ITEM : "reviews"
  LEARNER ||--o| WALLET_CREDENTIAL : "owns"
  LEARNER ||--o{ CODING_SESSION : practices
  PROBLEM ||--o{ CODING_SESSION : "solved in"
  CODING_SESSION ||--o{ CODING_VIVA : "defended by"
  LEARNER ||--|| GAME_PROFILE : "has XP"
  LEARNER ||--o{ CERTIFICATE : earns
  DRIVE ||--o{ DRIVE_ROLE : offers
  DRIVE ||--o{ ROUND : has
  DRIVE ||--o{ REGISTRATION : receives
  CANDIDATE ||--o{ REGISTRATION : applies
  DRIVE ||--o{ EXAM : runs
  EXAM ||--o{ EXAM_SESSION : "attempted in"
  CANDIDATE ||--o{ INTERVIEW : "interviewed in"
  DRIVE ||--o{ RESULT : produces
```

## 6.1 Key entities

- **User** (auth) - the credential/identity. A user is a **learner** in LARE Learn and/or a **candidate** in LARE Hire.
- **Skill Profile** (assessment) - the **Cognitive Twin**: a per-learner fusion of written-assessment and coding performance into skill dimensions (communication, coding, aptitude, project).
- **Wallet Credential** (assessment) - a signed, verifiable competence record with a public `verify_id`.
- **Drive / Round / Registration** (drive) - the recruitment pipeline.
- **Exam / Exam Session** (exam) - the proctored take-flow.
- **Result / Offer** (result) - compiled ranks and issued offers/PPOs.

\newpage

# 7. API Architecture

## 7.1 Conventions

- **Base path**: the SPA calls `/api`; Nginx proxies to the gateway; the gateway routes onward. Product prefixes: `/lms/...` (LARE Learn), `/drive/...` (LARE Hire), plus `/auth`, `/ai`, `/files`, `/notify`, `/analytics`, and the public `/verify`.
- **Versioning**: every route is versioned (`/v1/`).
- **Response envelope**: all JSON responses use `{ data, meta, errors }`. The client returns `data` on success and throws a typed `ApiError(code, status, details)` on failure.
- **Idempotency & safety**: reads are `GET`; state changes are `POST`/`PUT`/`DELETE`.
- **No client caching of per-user data**: the client sends `cache: "no-store"` so a shared machine never leaks one user's data to the next.

## 7.2 Authentication & sessions

- **RS256 JWT**. The **auth** service signs tokens with a private key; the gateway and every service verify with the public key. Keys are provided as `JWT_PRIVATE_KEY_FILE` / `JWT_PUBLIC_KEY_FILE`.
- **Access + refresh tokens**. The access token is short-lived; a refresh token exchanges for a new access token. The client performs a **de-duplicated silent refresh**: a burst of 401s triggers a single refresh, and the original requests replay. A genuine `expired` refresh logs out; a transient error keeps the session (critical mid-exam).
- **Internal service-to-service** calls use a shared `INTERNAL_JWT_SECRET`.

```mermaid
sequenceDiagram
  participant SPA
  participant GW as Gateway
  participant AUTH as Auth
  participant SVC as Service
  SPA->>GW: POST /api/auth/v1/login
  GW->>AUTH: /auth/v1/login
  AUTH-->>SPA: { access_token, refresh_token }
  SPA->>GW: GET /api/lms/v1/gamification/{id} (Bearer access)
  GW->>GW: verify RS256 JWT
  GW->>SVC: /lms/v1/gamification/{id}
  SVC-->>SPA: { data }
  Note over SPA,GW: On 401, SPA silently refreshes once and replays
```

## 7.3 Authorization

Routes are guarded by role (`require_roles`) and by subject ownership - e.g. a learner may read only their **own** gamification/scorecard; requesting another learner's id returns `403`. Recruiter/admin management routes require the appropriate staff roles.

## 7.4 Endpoint catalogue

The following is the complete client-facing endpoint surface, grouped by area. (Method is shown where not a plain `GET`.)

### 7.4.1 Auth & account
- `POST /auth/v1/register` - create an account.
- `POST /auth/v1/login` - email + password login.
- `POST /auth/v1/refresh` - exchange refresh token.
- `POST /auth/v1/password/forgot`, `POST /auth/v1/password/reset` - password reset.
- `POST /auth/v1/otp/request`, `POST /auth/v1/otp/verify` - OTP login.
- `POST /auth/v1/email/verify/request`, `POST /auth/v1/email/confirm` - email verification.
- `POST /auth/v1/logout` - revoke refresh token.
- `GET /auth/v1/me` - current user.
- `PUT /notify/v1/preferences` - notification channel prefs.

### 7.4.2 LARE Learn - learning core
- `GET /lms/v1/curricula`, `GET /lms/v1/curricula/{id}/tree` - curriculum + tree.
- `GET /lms/v1/content/playlist?learner_id=...` - personalised playlist.
- `GET /lms/v1/content/recommendations?learner_id=...` - recommendations.
- `POST /lms/v1/content/{id}/progress` - record content progress.
- `GET /lms/v1/progress/{learnerId}` - progress summary.
- `GET /lms/v1/progress/{learnerId}/scorecard` - skill scorecard.
- `GET /lms/v1/gamification/{learnerId}` - XP/level/badges/streak.
- `GET /lms/v1/gamification/leaderboard/global` - leaderboard.
- `GET /lms/v1/assessments`, `POST /lms/v1/assessments`, `GET /lms/v1/assessments/{aid}` - assessments.
- `POST /lms/v1/assessments/{aid}/attempts`, `POST /lms/v1/attempts/{attemptId}/submit` - take-flow.
- `GET /lms/v1/assessments/summary?learner_id=...` - assessment summary.

### 7.4.3 LARE Learn - Cognitive Twin, coaching, careers, reviews
- `GET /lms/v1/assessments/twin/{learnerId}` - the LMS Cognitive Twin.
- `GET /lms/v1/assessments/coach/{learnerId}` (`?force=1` regenerates) - AI study plan.
- `POST /lms/v1/assessments/coach/{learnerId}/progress` - mark a plan day done.
- `POST /lms/v1/assessments/nudge/{learnerId}` - send the weakest-area nudge.
- `GET /lms/v1/careers`, `POST /lms/v1/careers`, `DELETE /lms/v1/careers/{cid}` - career roles.
- `GET /lms/v1/careers/readiness/{learnerId}` - readiness against roles.
- `GET /lms/v1/reviews/{learnerId}`, `POST /lms/v1/reviews/{learnerId}/review` - spaced review.
- `POST /lms/v1/reviews/{learnerId}/activity` - record real practice into the schedule.

### 7.4.4 LARE Learn - practice, drill, worlds, mesh, lessons, wallet
- `GET /lms/v1/practice/problems`, `POST /lms/v1/practice/session`, `POST /lms/v1/practice/{sid}/run`, `POST /lms/v1/practice/{sid}/submit` - coding practice.
- `GET /lms/v1/practice/skills/{learnerId}` - practice-derived skills.
- `POST /lms/v1/practice/{sid}/viva`, `POST /lms/v1/practice/viva/{vivaId}` - adversarial viva.
- `POST /lms/v1/drill/start`, `POST /lms/v1/drill/{drillId}/answer` - adaptive drill.
- `GET /lms/v1/worlds`, `POST /lms/v1/worlds/{worldId}/start`, `POST /lms/v1/worlds/runs/{runId}/answer` - practice worlds.
- `GET /lms/v1/mesh/{learnerId}`, `GET /lms/v1/mesh/{learnerId}/sessions`, `POST /lms/v1/mesh/request`, `POST /lms/v1/mesh/{sessionId}/respond`, `POST /lms/v1/mesh/{sessionId}/complete` - peer mesh.
- `POST /lms/v1/micro-lessons/{learnerId}/generate`, `GET /lms/v1/micro-lessons/{learnerId}`, `POST /lms/v1/micro-lessons/author-blocks` - AI micro-lessons.
- `GET /lms/v1/wallet/{learnerId}`, `POST .../issue`, `POST .../revoke`, `GET .../export.pdf`, `GET /verify/wallet/{verifyId}` - the wallet.

### 7.4.5 LARE Learn - authoring & staff
- `GET/POST /lms/v1/colleges`, `GET/POST /lms/v1/colleges/{cid}/cohorts` - institutions.
- `GET/POST /lms/v1/learners`, `POST /lms/v1/learners/import`, `POST /lms/v1/learners/{lid}/verify`, `POST /lms/v1/learners/{lid}/promote` - roster.
- `POST /lms/v1/curricula`, `.../years`, `.../modules`, `.../lessons`, `GET /lms/v1/lessons/{lid}`, `PUT /lms/v1/lessons/{lid}/content`, `POST /lms/v1/lessons/{lid}/check`, `POST /lms/v1/curricula/{cid}/publish` - curriculum authoring.
- `POST /lms/v1/attendance`, `POST /lms/v1/progress/compute-year`, `POST /lms/v1/answers/{answerId}/grade` - trainer progress.
- `GET/POST /lms/v1/certificates/...`, `GET /lms/v1/certificates/{id}/pdf`, `GET /verify/{verifyId}` - certification.

### 7.4.6 LARE Hire - candidate & drives
- `GET /drive/v1/drives`, `GET /drive/v1/drives/{id}` - browse drives.
- `POST /drive/v1/attend`, `POST /drive/v1/attend/resume` - public attend flow (no login).
- `POST /drive/v1/candidate/apply`, `GET /drive/v1/candidate/applications`, `GET/PUT /drive/v1/candidate/profile` - candidate.
- `GET /drive/v1/opportunities?candidate_id=...` - matched opportunities.
- `GET /drive/v1/evaluations/twin/{candidateId}` - the Hire evaluation twin.

### 7.4.7 LARE Hire - exam take-flow & proctoring
- `GET /drive/v1/exams`, `GET /drive/v1/exams/{examId}`, `GET /drive/v1/exams/{examId}/paper` - exam meta/paper.
- `POST /drive/v1/exams/{examId}/start`, `GET /drive/v1/exam-sessions/{sid}/state`, `POST .../save`, `POST .../submit` - session flow.
- `POST /drive/v1/proctor/start`, `POST /drive/v1/proctor/{examSessionId}/events` - proctoring.
- `POST /drive/v1/coding/run-adhoc`, `GET /drive/v1/coding/languages`, `POST /drive/v1/coding/session`, `POST .../run`, `POST .../submit` - coding rounds.

### 7.4.8 LARE Hire - recruiter management
- `POST /drive/v1/drives`, `DELETE /drive/v1/drives/{id}`, `.../roles`, `.../eligibility`, `.../rounds`, `GET/PUT .../workflow` - drive setup.
- `GET .../rounds/{order}/scores`, `POST .../scores`, `POST .../candidates`, `DELETE .../candidates/{cid}`, `POST .../publish` - rounds.
- `GET .../rounds/{order}/export` - marks .xlsx export.
- `POST .../register`, `POST .../shortlist`, `POST .../advance`, `GET .../funnel`, `GET .../registrations`, `GET .../analytics` - pipeline.
- `POST /drive/v1/interviews/schedule`, `.../allocate`, `.../rate`, `.../decision`, `GET /drive/v1/interviews/drive/{driveId}` - interviews.
- `POST /drive/v1/evaluations/rank`, `GET .../exam/{examId}/ranks`, `GET .../exam/{examId}/difficulty` - evaluation.
- `POST /drive/v1/results/compile`, `GET /drive/v1/results/{driveId}`, `POST .../publish`, `POST /drive/v1/offers/generate`, `POST /drive/v1/offers/{offerId}/status` - results & offers.
- `POST /drive/v1/questions`, `GET /drive/v1/questions`, `POST .../activate`, `POST /drive/v1/blueprints`, `POST .../generate-paper`, `POST /drive/v1/exams`, `POST /drive/v1/questions/generate` (AI) - question bank.

### 7.4.9 Platform
- `GET /analytics/v1/dashboard/{role}`, `GET /analytics/v1/colleges/ranking` - analytics.
- `GET /notify/v1/inbox`, `POST /notify/v1/inbox/{id}/read` - notifications.
- `POST /files/v1/upload-url`, `PUT /files/v1/upload/{token}`, `POST /files/v1/{fileId}/complete` - pre-signed upload.
- `POST /ai/v1/tutor/chat`, `GET /ai/v1/tutor/sessions`, `GET /ai/v1/tutor/sessions/{sid}/messages`, `POST /ai/v1/tutor/study-plan`, `POST /ai/v1/tutor/stream-advice` - AI tutor.

\newpage

# 8. Frontend Architecture

## 8.1 Overview

The frontend is a **single-page application (SPA)** built with **React 18 + Vite**. It serves **both products** from one bundle, with routing and navigation that keep LARE Learn and LARE Hire separate.

```mermaid
flowchart LR
  subgraph SPA["React + Vite SPA"]
    RT["React Router v6"]
    AUTHX["Auth context (JWT + user)"]
    APIC["API client (fetch + envelope + refresh)"]
    UI["Design system (primitives, states)"]
    SHELL["AppShell (nav + sidebar)"]
    PAGES["43 page components"]
  end
  RT --> SHELL --> PAGES
  PAGES --> APIC
  PAGES --> UI
  AUTHX --> APIC
```

## 8.2 Routing & guards

- **React Router v6** with route specificity: public routes (`/`, `/login`, `/register`, `/forgot-password`, `/drive/attend`, `/verify/...`), an app chooser (`/apps`), and product route groups (`/lms/...`, `/drive/...`).
- **Guards**: `Protected` (must be logged in), `lms(...)`/`drive(...)` (product wrappers with the AppShell), and `lmsStaff(...)`/`driveStaff(...)` (staff-only consoles). Wrong-role or logged-out users are redirected.
- **Public verify pages** are intentionally unauthenticated so an employer can verify a certificate or wallet without an account.

## 8.3 The API client (`lib/api.js`)

- A single `request(path, opts)` wrapper over `fetch` that adds the JWT, sets `cache: "no-store"`, unwraps the `{ data }` envelope, and throws a typed `ApiError` on failure.
- **Silent refresh**: on `401`, a de-duplicated refresh runs once and the request replays. Binary/raw downloads also benefit from refresh (so exports do not fail mid-session).
- **`withFallback(promise, fallback)`**: renders a graceful state if a call fails. In **development** it returns demo data so screens render with the backend down; in a **production build it blanks the fallback to an empty, same-shape state**, so the deployed app never shows fabricated or another user's data.
- `api` is a flat object of named methods, one per endpoint (the catalogue in section 7).

## 8.4 Authentication context (`lib/auth.jsx`)

Holds the current `user` (from `/auth/v1/me`) and the tokens (in `localStorage`). Exposes `useAuth()` so any page can read `user` (id, full_name, email, roles). Pages derive `learnerId = user?.id` and pass it to per-user calls.

## 8.5 Design system

Two shared modules provide a consistent, themeable UI:

- **`components/ui/primitives.jsx`** - the building blocks: `Card`, `Button` (variants: primary, secondary, ghost, amber; supports `as={Link}`), `Badge` (tone: brand/teal/amber/rose/slate), `Input`, `Field`, `XPBar`, `StatTile`.
- **`components/ui/states.jsx`** - `PageHeader`, `Loading`, `DataSource` (a live/demo indicator), and empty/error states.
- **`components/ui/Logo.jsx`** - the LARE brand mark.

Design language: a navy + gold brand palette, a display + body type pairing, generous spacing, rounded cards, and Framer Motion for subtle animation (XP bars, reveals).

## 8.6 Shared components

- **`layout/AppShell.jsx`** - the authenticated shell: top bar, the product sidebar navigation (internally scrollable via `.sidebar-scroll`), and the routed page area. The sidebar lists exactly the pages for the active product/role.
- **`ProctorBanner.jsx`** - the proctoring/integrity banner + hooks shown on every page where a student submits an answer (assessments, coding, drill, worlds, exam). It surfaces integrity flags and reports proctor events.
- **`LessonBlocks.jsx`** - renders AI-generated lesson content blocks: headings, rich text, code blocks, tables, callouts, and interactive "checks" (mini-questions graded inline).
- **`lib/markdown.js`** - a lightweight markdown renderer for tutor/lesson text.
- **`lib/certificate.js`** - certificate rendering/printing/PDF helpers.

## 8.7 Frontend build & serving

- `npm run build` (Vite) produces a hashed bundle in `frontend/dist`.
- The bundle is published to the Nginx web root (`/var/www/lare`) and served as static files; `/api` is reverse-proxied to the gateway.
- Cache-busting is automatic via content-hashed filenames (`index-<hash>.js`).

\newpage

# 9. Page-by-Page Walkthrough

This section documents **every screen** in the application: its route, purpose, the elements and controls on it, the actions its buttons perform, and the data it reads/writes. Screens are grouped by area.

## 9.A Public & Authentication

### 9.A.1 Landing (`/`)
- **Purpose**: marketing entry point introducing LARE Learn and LARE Hire.
- **Elements**: hero headline + tagline, product highlights, calls to action.
- **Buttons**: **Log in** (to `/login`), **Get started / Register** (to `/register`).

### 9.A.2 Login (`/login`)
- **Purpose**: email + password sign-in.
- **Elements**: email field, password field, "remember", error banner.
- **Buttons**: **Sign in** (calls `POST /auth/v1/login`, stores tokens, redirects to `/apps`), **Forgot password?** (to `/forgot-password`), **Create account** (to `/register`). OTP login path where enabled.
- **Data**: `api.login`, then `api.me`.

### 9.A.3 Register (`/register`)
- **Purpose**: create an account.
- **Elements**: full name, email, password (+ confirm), validation messages.
- **Buttons**: **Create account** (`POST /auth/v1/register`), then email verification prompt (`api.requestEmailVerify`).

### 9.A.4 Forgot Password (`/forgot-password`)
- **Purpose**: request a reset link / reset with token.
- **Buttons**: **Send reset link** (`api.forgotPassword`), **Reset password** (`api.resetPassword`).

### 9.A.5 Auth Layout (component)
- Shared split-screen frame for the auth pages (brand panel + form panel).

### 9.A.6 App Chooser (`/apps`)
- **Purpose**: after login, choose the product to enter (LARE Learn or LARE Hire), filtered by the user's roles.
- **Buttons**: **Enter LARE Learn** (`/lms`), **Enter LARE Hire** (`/drive`).

### 9.A.7 Attend Drive (`/drive/attend`)
- **Purpose**: public, **no-login** drive attendance for walk-in campus drives.
- **Elements**: drive code / student details form; resume-by-id.
- **Buttons**: **Attend** (`api.attendDrive` -> returns a scoped student session), **Resume** (`api.attendResume`).

### 9.A.8 Wallet Verify (`/verify/wallet/:verifyId`)
- **Purpose**: public verification of a Sovereign Learning Wallet credential.
- **Elements**: signature-verified status, subject name, issued date, competence claims.
- **Data**: `api.verifyWallet(verifyId)` (public, no auth).

### 9.A.9 Certificate Verify (`/verify/:verifyId`)
- **Purpose**: public certificate verification page. Accepts a readable id (e.g. `LARE-VER-####`).
- **Elements**: verify-id input, verified certificate render (holder name, issued date, credential).
- **Buttons**: **Verify** (`api.verifyCertificate(verifyId)`), which opens the certificate.

## 9.B LARE Learn - Student

### 9.B.1 Dashboard (`/lms`)
- **Purpose**: the learner's personalised home. **All values are the logged-in learner's real data** (no hard-coded content).
- **Elements**:
  - **Hero**: Level badge, greeting ("Welcome" for new users, "Keep it up" for active), and an **XP bar** (`total_xp` toward `next_level_at`).
  - **Stat tiles**: Current streak (+ best), Total XP, Badges count, Level.
  - **Skill scorecard**: animated bars for Communication, Coding, Aptitude, Project (real percentages; empty state for new users).
  - **Recent badges**: earned badges, or an encouraging empty state.
  - **Up next**: a card linking into learning.
- **Buttons**: **Start/Continue learning** and **Go to My Learning** (to `/lms/learning`).
- **Data**: `api.game(user.id)`, `api.scorecard(user.id)` with honest zero fallbacks.

### 9.B.2 My Learning (`/lms/learning`)
- **Purpose**: the curriculum and the learner's personalised content playlist.
- **Elements**: curriculum tree (years -> modules -> lessons), the playlist (video/reading/interactive items with lock/complete/in-progress states), progress indicators.
- **Buttons**: open a content item, resume, mark complete (writes `api.contentProgress`).
- **Data**: `api.curricula` + `api.curriculumTree`, `api.playlist(user.id)`.

### 9.B.3 Assessments (`/lms/assessments`)
- **Purpose**: browse and take assessments; results feed the twin.
- **Elements**: list of assessments (title, pass %, duration), the take-flow (items, options, timer), a **ProctorBanner** while answering.
- **Buttons**: **Start** (`api.startAttempt`), **Submit** (`api.submitAttempt`).
- **Data**: `api.listAssessments`, `api.getAssessment`.

### 9.B.4 Coding Practice (`/lms/practice`)
- **Purpose**: student-facing coding practice on the same sandbox as Drive.
- **Elements**: problem list (by skill/difficulty), code editor, language selector, sample cases, run output, verdict; **ProctorBanner** on submit.
- **Buttons**: **Open** (`api.practiceOpen`), **Run** (`api.practiceRun`), **Submit** (`api.practiceSubmit`), **Start viva** (`api.vivaStart`).
- **Data**: `api.practiceProblems`, `api.practiceSkills(user.id)`.

### 9.B.5 Coding IDE (component/page)
- **Purpose**: the reusable code editor used by practice and coding rounds - editor, language dropdown, run/submit, test-case results panel, starter templates per language.

### 9.B.6 Adaptive Drill (`/lms/drill`)
- **Purpose**: a "flow" drill whose difficulty tunes in real time.
- **Elements**: topic/target selector, one question at a time, live difficulty/level indicator, streak, timing; **ProctorBanner**.
- **Buttons**: **Start drill** (`api.drillStart`), **Answer** (`api.drillAnswer` with elapsed time).

### 9.B.7 Practice Worlds (`/lms/worlds`)
- **Purpose**: browser-based workplace simulations (embodied practice).
- **Elements**: world catalogue (role/skill/difficulty), stepped scenario runner, score/pass indicator; **ProctorBanner** on answer.
- **Buttons**: **Start** (`api.startWorld`), **Answer step** (`api.answerWorld`).

### 9.B.8 My Skill Map (`/lms/skill-map`)
- **Purpose**: the Cognitive Twin visualised - strengths and gaps.
- **Elements**: skill dimensions with mastery, sources (written vs coding), weakest-area highlights.
- **Data**: `api.skillTwin(user.id)`, `api.practiceSkills(user.id)`.

### 9.B.9 Career Readiness (`/lms/careers`)
- **Purpose**: Skills-to-Opportunity - readiness against target career roles.
- **Elements**: role cards with required-skills coverage, gap list, readiness percentage.
- **Data**: `api.listCareers`, `api.careerReadiness(user.id)`.

### 9.B.10 Keep Sharp (`/lms/keep-sharp`)
- **Purpose**: forgetting-aware spaced review queue.
- **Elements**: due items (skill, last mastery, interval), review prompts.
- **Buttons**: **Review** (`api.submitReview` with outcome), which reschedules via spaced repetition.
- **Data**: `api.reviewQueue(user.id)`.

### 9.B.11 Peer Mesh (`/lms/mesh`)
- **Purpose**: AI-matched peer teach-back (learn by teaching).
- **Elements**: "Get help from a peer" (mentors per weak topic), "You could teach" (topics you have mastered where peers need help), incoming requests, active teach-backs.
- **Buttons**: **Ask** (per mentor -> `api.meshRequest`; marks only that mentor "requested"), **Accept/Decline** (`api.meshRespond`), **Mark done** (`api.meshComplete`).
- **Data**: `api.meshOverview(user.id)`, `api.meshSessions(user.id)`.

### 9.B.12 Micro-Lessons (`/lms/lessons`) & Lesson Viewer (`/lms/lesson/:lid`)
- **Purpose**: on-demand AI-generated lessons and the reader.
- **Elements (Lessons)**: generate-by-topic input, list of the learner's generated lessons.
- **Buttons**: **Generate** (`api.generateLesson`), open a lesson.
- **Elements (Viewer)**: rendered **LessonBlocks** - headings, rich text, code blocks, tables, callouts, and inline **checks** (mini-questions graded via `api.gradeLessonCheck`, which also records practice into the review schedule).

### 9.B.13 Achievements (`/lms/achievements`)
- **Purpose**: XP, badges, streaks, and the leaderboard.
- **Elements**: level hero (level, total XP, XP bar, streak), stat tiles, skill scorecard, badges grid, leaderboard.
- **Data**: `api.game(user.id)`, `api.scorecard(user.id)`, `api.leaderboard` (empty fallbacks - never demo numbers).

### 9.B.14 AI Tutor (`/lms/tutor`)
- **Purpose**: conversational tutor for DSA, aptitude, interviews, and study plans.
- **Elements**: chat thread, message input, session list; study-plan generator.
- **Buttons**: **Send** (`api.tutorChat`), **Generate study plan** (`api.studyPlan`), open past sessions (`api.tutorSessions`, `api.tutorMessages`).

### 9.B.15 Certificates (`/lms/certificates`)
- **Purpose**: view, print, download, and verify certificates.
- **Elements**: issued-certificate list; a **viewer modal** rendering the certificate.
- **Buttons**: **View** (opens modal), **Print** (browser print of the certificate), **Download PDF** (`api.downloadCertificatePdf`), **Verify certificate** (opens the public verify page with the readable id).
- **Data**: `api.certificates(user.id)`.

### 9.B.16 My Wallet (`/lms/wallet`)
- **Purpose**: the Sovereign Learning Wallet - a signed, verifiable competence record.
- **Elements**: credential summary, signature status, verify id/QR.
- **Buttons**: **Issue** (`api.issueWallet`), **Revoke** (`api.revokeWallet`), **Download PDF** (`api.downloadWalletPdf`), **Public verify link** (`/verify/wallet/:id`).
- **Data**: `api.getWallet(user.id)`.

### 9.B.17 Profile (`/lms/profile`, `/drive/profile`)
- **Purpose**: the recruitment/portfolio profile. **Shows the logged-in user's own data**; on a failed load it seeds from the user's own identity (never another person).
- **Elements**: editable details (name, email, phone, branch, CGPA), education, projects, skills, contact, profile-completeness bar, resume/photo upload.
- **Buttons**: **Save changes** (`api.updateProfile`; shows a real error on failure), **Upload resume/photo** (3-step pre-signed upload).

### 9.B.18 Notifications (`/lms/notifications`, `/drive/notifications`)
- **Purpose**: in-app inbox.
- **Elements**: message list (subject, body, read/unread, time).
- **Buttons**: **Mark read** (`api.markRead`). **Data**: `api.inbox`.

### 9.B.19 Settings (`/lms/settings`, `/drive/settings`)
- **Purpose**: account and notification preferences.
- **Buttons**: toggle channels (`api.setNotifyPref`), account actions.

\newpage

## 9.C LARE Learn - Staff Consoles

### 9.C.1 Admin Console (`/lms/admin`)
- **Purpose**: college/organisation administration and admin analytics.
- **Elements**: KPI tiles (colleges, learners, drives), top-college readiness ranking, colleges table, learners table with filters.
- **Buttons**: **Create college** (`api.createCollege`), manage cohorts (`api.collegeCohorts`, `api.createCohort`), open learner detail.
- **Data**: `api.dashboard("college_admin")`, `api.colleges`, `api.learners`.

### 9.C.2 Curriculum Studio (`/lms/curriculum`)
- **Purpose**: author **real** curriculum + AI-assisted lesson material (not just titles).
- **Elements**: loads the real curriculum tree; editors for years, modules, lessons; a lesson content editor that builds a block list (text, code, tables, callouts, checks).
- **Buttons**: **Add year/module/lesson** (`api.addYear/addModule/addLesson`), **AI-generate blocks** (`api.authorBlocks(topic)` -> review and insert), **Save lesson content** (`api.setLessonContent`), **Publish curriculum** (`api.publishCurriculum`).

### 9.C.3 Lesson Editor (component)
- The lesson content editor used by Curriculum Studio: add/reorder/edit blocks, AI-generate a comprehensive lesson (tables, code, examples, callouts, checks), preview, and save into the lesson's JSON `content`.

### 9.C.4 Trainer Console (`/lms/trainer`)
- **Purpose**: roster, attendance, grading, and progress.
- **Elements**: learner roster, attendance capture, answer-grading queue, year-computation controls.
- **Buttons**: **Mark attendance** (`api.markAttendance`), **Grade answer** (`api.gradeAnswer`), **Compute year** (`api.computeYear`), **Verify/Promote learner** (`api.verifyLearner`, `api.promoteLearner`).
- **Data**: `api.learners`.

## 9.D LARE Hire - Candidate

### 9.D.1 Drives (`/drive`)
- **Purpose**: browse open drives and attend.
- **Elements**: drive cards (company, title, venue, reporting time, status).
- **Buttons**: **View** (`api.drive(id)`), **Apply** (`api.apply`).
- **Data**: `api.drives("open")`.

### 9.D.2 Matched Opportunities (`/drive/opportunities`)
- **Purpose**: open drives matched to the candidate's verified skills (Skills-to-Opportunity for Hire).
- **Elements**: matched drive/role cards with skill-match indicators.
- **Data**: `api.matchedOpportunities(candidateId)`.

### 9.D.3 Exam Portal (`/drive/test/:examId`)
- **Purpose**: the proctored exam-taking experience.
- **Elements**: exam meta/instructions, the paper (MCQ + coding items), timer, question navigator, autosave, a persistent **ProctorBanner** with anti-cheat hooks (tab/focus/visibility events reported to the anticheat service).
- **Buttons**: **Start** (`api.examStart`), per-item save (`api.examSave`), **Submit** (`api.examSubmit`). Coding items use the Coding IDE (`api.codingOpen/Run/Submit`).
- **Data**: `api.examMeta`, `api.examPaper`, `api.examState`; proctoring via `api.proctorStart`, `api.proctorEvent`.

## 9.E LARE Hire - Recruiter

### 9.E.1 Recruiter Drives (`/drive/recruiter/drives`)
- **Purpose**: list and create drives.
- **Elements**: drive list (status, venue), create form.
- **Buttons**: **Create drive** (`api.createDrive`), open a drive (`/drive/recruiter/drives/:id`), delete (`api.deleteDrive`).
- **Data**: `api.drives()`.

### 9.E.2 Drive Console (`/drive/recruiter/drives/:id`)
- **Purpose**: the per-drive command centre. A tabbed console composing the following tabs, plus the drive header (company, title, status, funnel).
- **Header/overview**: funnel counts (`api.funnel`), open-drive control (`api.openDrive`), roles/eligibility/rounds/workflow setup.
- **Buttons**: **Add role** (`api.addRole`), **Set eligibility** (`api.setEligibility`), **Add round** (`api.addRound`), **Edit workflow** (`api.getWorkflow`/`api.setWorkflow`), **PPO config** (`api.setPpo`), **Open drive**.
- **Data**: `api.drive(id)`, `api.funnel(id)`, `api.driveRegistrations(id)`.

### 9.E.3 Rounds Tab (within Drive Console)
- **Purpose**: round-by-round marks sheets and progression.
- **Elements**: round selector, editable marks table (Round 1 auto-seeded from applicants; later rounds panel-scored), candidate search/filter, skills popover, add/remove candidate.
- **Buttons**: **Save score** (`api.setRoundScore`), **Add candidate** (`api.addRoundCandidate`), **Remove candidate** (`api.removeRoundCandidate`), **Publish round** (`api.publishRound`; cleared candidates advance), **Delete round** (`api.deleteRound`), **Download all / Download cleared** (`api.downloadRoundXlsx` -> .xlsx; now resilient to token expiry).

### 9.E.4 Results Tab (within Drive Console)
- **Purpose**: compile, publish, and turn results into offers.
- **Elements**: cutoff input, per-candidate final-score inputs, results table (rank, candidate, score, outcome, offer), publish state.
- **Buttons**: **Compile** (`api.compileResults` -> `api.driveResults`; shows a real error on failure - no fabricated results), **Publish results** (`api.publishResults`), **PPO offer / Offer** (`api.generateOffer`), offer verify link (`/verify/offer/:id`).

### 9.E.5 Interviews Tab (within Drive Console)
- **Purpose**: schedule and run interviews.
- **Elements**: interview list (candidate, stage, mode, status, rating, decision).
- **Buttons**: **Schedule** (`api.scheduleInterview`), **Allocate** (`api.allocateInterview`), **Rate** (`api.rateInterview`), **Decide** (`api.decideInterview`).
- **Data**: `api.driveInterviews(id)`.

### 9.E.6 Analytics Tab (within Drive Console)
- **Purpose**: drive analytics with Excel export.
- **Elements**: score distribution, coding stats, funnel; export controls.
- **Buttons**: **Download attendees / Download cleared** (`api.downloadRoundXlsx`), **Refresh** (`api.driveAnalytics`).

### 9.E.7 Question Bank (`/drive/recruiter/questions`)
- **Purpose**: author and manage questions; build papers.
- **Elements**: question list (type, category, difficulty, status, version), authoring form, AI generation, blueprint builder, drive selector.
- **Buttons**: **Create question** (`api.createQuestion`), **Activate** (`api.activateQuestion`), **AI-generate questions** (`api.generateQuestions`), **Create blueprint** (`api.createBlueprint`), **Generate paper** (`api.generatePaper`), **Create exam** (`api.createExam`), **Upsert eval key** (`api.upsertEvalKey`).
- **Data**: `api.listQuestions`, `api.drives()`.

\newpage

# 10. UML Models

## 10.1 Actors

| Actor | Product | Description |
|---|---|---|
| **Student / Learner** | Learn | Learns, practices, takes assessments, earns credentials. |
| **Trainer** | Learn | Authors progress, attendance, grading. |
| **College Admin** | Learn | Manages colleges, cohorts, learners; views analytics. |
| **Super Admin** | Both | Platform-wide administration. |
| **Candidate** | Hire | Applies to drives, takes exams/interviews. |
| **Recruiter** | Hire | Builds drives, question banks, evaluates and hires. |
| **Interviewer** | Hire | Rates and decides interviews. |
| **Employer / Verifier** | Public | Verifies a certificate or wallet without an account. |

## 10.2 Use-case diagram

```mermaid
flowchart LR
  Student(("Student"))
  Trainer(("Trainer"))
  Admin(("College Admin"))
  Candidate(("Candidate"))
  Recruiter(("Recruiter"))
  Verifier(("Employer/Verifier"))

  subgraph Learn["LARE Learn"]
    UC1["Learn via curriculum"]
    UC2["Take assessment"]
    UC3["Practice coding"]
    UC4["Adaptive drill"]
    UC5["View Skill Map / Twin"]
    UC6["Generate micro-lesson"]
    UC7["Peer teach-back"]
    UC8["Earn XP / badges"]
    UC9["Get certificate / wallet"]
    UC10["Author curriculum"]
    UC11["Grade / attendance"]
    UC12["Admin analytics"]
  end
  subgraph Hire["LARE Hire"]
    UC13["Browse / attend drive"]
    UC14["Take proctored exam"]
    UC15["Build question bank"]
    UC16["Run drive rounds"]
    UC17["Compile results / offer"]
    UC18["Conduct interview"]
    UC19["Match opportunities"]
  end
  UC20["Verify credential"]

  Student --> UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7 & UC8 & UC9
  Trainer --> UC10 & UC11
  Admin --> UC12 & UC10
  Candidate --> UC13 & UC14 & UC19
  Recruiter --> UC15 & UC16 & UC17
  Recruiter --> UC18
  Verifier --> UC20
```

## 10.3 Selected use-case descriptions

**UC14 - Take a proctored exam**
- **Actor**: Candidate. **Pre**: registered/eligible for a drive with an exam. **Main flow**: start exam -> proctoring session begins -> answer MCQ/coding items with autosave -> anti-cheat events captured -> submit -> auto/queued evaluation. **Post**: an exam session with answers and integrity flags exists. **Alt**: token expiry mid-exam is transparently refreshed; network blips keep the session.

**UC17 - Compile results and issue an offer**
- **Actor**: Recruiter. **Pre**: rounds scored. **Main flow**: enter final scores -> set cutoff -> compile (server ranks) -> review -> publish -> generate offer/PPO -> candidate/verifier can view a signed offer. **Exceptions**: on server error, a clear message is shown (no fabricated results).

**UC9 - Earn a verifiable credential**
- **Actor**: Student. **Main flow**: complete requirements -> certificate issued with a readable `verify_id` -> student views/prints/downloads PDF -> anyone verifies publicly. The Sovereign Wallet packages competence claims, signs them, and exposes a public verify page.

## 10.4 Sequence - Proctored exam

```mermaid
sequenceDiagram
  participant C as Candidate (SPA)
  participant GW as Gateway
  participant EX as Exam
  participant AC as Anticheat
  participant CO as Coding
  C->>GW: POST /drive/v1/exams/{id}/start
  GW->>EX: start
  EX-->>C: exam session + paper
  C->>GW: POST /drive/v1/proctor/start
  GW->>AC: begin proctoring
  loop answering
    C->>GW: POST exam-sessions/{sid}/save (answers)
    C->>GW: POST proctor/{sid}/events (focus/tab/visibility)
    GW->>AC: record integrity events
    opt coding item
      C->>GW: POST /drive/v1/coding/{sid}/run|submit
      GW->>CO: sandbox execute
    end
  end
  C->>GW: POST exam-sessions/{sid}/submit
  GW->>EX: finalise
  EX-->>C: submitted
```

## 10.5 Sequence - AI micro-lesson generation

```mermaid
sequenceDiagram
  participant S as Student (SPA)
  participant GW as Gateway
  participant AS as Assessment
  participant AIO as AI Orchestration
  participant G as Gemini
  S->>GW: POST micro-lessons generate (topic)
  GW->>AS: generate lesson
  AS->>AIO: request lesson blocks (marker format)
  AIO->>G: prompt
  G-->>AIO: lesson text (blocks)
  AIO-->>AS: parsed blocks
  AS-->>S: lesson blocks (persisted)
  Note over AS: transient 503 retries, never a generic template
```

## 10.6 Sequence - Drive round to result to offer

```mermaid
sequenceDiagram
  participant R as Recruiter (SPA)
  participant GW as Gateway
  participant DR as Drive
  participant RES as Result
  R->>GW: POST rounds/{order}/scores
  GW->>DR: save marks
  R->>GW: POST rounds/{order}/publish
  GW->>DR: advance cleared candidates
  R->>GW: POST results/compile {cutoff, rows}
  GW->>RES: rank & compile
  R->>GW: POST results/{driveId}/publish
  R->>GW: POST offers/generate
  GW->>RES: signed offer
  RES-->>R: offer verify id
```

## 10.7 Class diagram (key domain)

```mermaid
classDiagram
  class User { id; email; full_name; roles }
  class Learner { id; branch; year_no; cgpa }
  class SkillProfile { learner_id; communication; coding; aptitude; project }
  class GameProfile { learner_id; total_xp; level; badges; streak }
  class WalletCredential { verify_id; subject_name; payload; signature; revoked }
  class Assessment { id; title; pass_pct; proctored; shuffle }
  class Attempt { id; assessment_id; learner_id; score }
  class Problem { id; skill; difficulty; practice }
  class CodingSession { id; problem_id; kind }
  class CodingViva { id; coding_session_id; score; passed }
  class Drive { id; company_name; status }
  class Round { drive_id; order; type }
  class Registration { drive_id; candidate_id; status }
  class Result { drive_id; candidate_id; rank; outcome }
  User <|-- Learner
  Learner --> SkillProfile
  Learner --> GameProfile
  Learner --> WalletCredential
  Assessment --> Attempt
  Problem --> CodingSession
  CodingSession --> CodingViva
  Drive --> Round
  Drive --> Registration
  Drive --> Result
```

## 10.8 Component diagram

```mermaid
flowchart TB
  subgraph FE["Frontend (SPA)"]
    R["Router + Guards"]
    A["Auth context"]
    API["API client"]
    DS["Design system"]
  end
  subgraph GWc["Gateway"]
    AUTHZ["JWT verify"]
    ROUTE["Longest-prefix router"]
  end
  subgraph Learnc["Learn services"]
    L1["curriculum"]; L2["content"]; L3["progress"]; L4["assessment"]; L5["gamification"]; L6["certification"]; L7["coding"]
  end
  subgraph Hirec["Hire services"]
    H1["drive"]; H2["questionbank"]; H3["exam"]; H4["anticheat"]; H5["evaluation"]; H6["interview"]; H7["result"]; H8["candidate"]
  end
  subgraph Platc["Platform services"]
    P1["auth"]; P2["institution"]; P3["learner"]; P4["notification"]; P5["files"]; P6["analytics"]; P7["audit"]; P8["ai_orchestration"]; P9["ai_tutor"]; P10["organization"]
  end
  API --> AUTHZ --> ROUTE
  ROUTE --> Learnc & Hirec & Platc
```

## 10.9 Deployment diagram

```mermaid
flowchart TB
  DNS["DNS / Route 53"] --> EIP["Elastic IP"]
  EIP --> EC2
  subgraph EC2["EC2 (Ubuntu)"]
    NGINX["Nginx :443/:80"]
    GW["Gateway :8000"]
    S["services :8001..8026"]
    NGINX -->|/ static| DIST["/var/www/lare"]
    NGINX -->|/api| GW --> S
  end
  S --> RDS["RDS PostgreSQL :5432"]
  S --> AIEXT["Gemini / Mistral APIs"]
  S --> SMTP["Zoho SMTP"]
```

\newpage

# 11. Feature Deep-Dives

## 11.1 The Cognitive Twin
A per-learner **skill profile** fused from two evidence streams: **written assessments** and **coding performance**. It maps activity onto four dimensions (communication, coding, aptitude, project) and identifies the **weakest area**, which drives the coach, reviews, and micro-lessons. LARE Hire has an analogous **evaluation twin** built from real drive-exam performance.

## 11.2 Persistent AI coach + nudging
The coach generates a **study plan** targeting the weakest area, persists it, tracks day-by-day completion, and can **nudge** the learner (in-app + email) with their plan. Regeneration is available on demand.

## 11.3 AI micro-lessons (Generative Learning Fabric)
On-demand lessons are generated as a **block list** (headings, rich text, code, tables, callouts, and inline checks). To keep code and tables intact, generation uses a **marker format + deterministic parser** rather than fragile strict-JSON; transient provider errors retry and never persist a generic template. The same block format powers the **Curriculum Studio** authoring experience.

## 11.4 Adaptive drill (Flow layer)
A drill that serves one question at a time and **tunes difficulty in real time** from correctness and speed, keeping the learner in a productive "flow" band.

## 11.5 Practice Worlds (Embodied Practice)
Stepped, browser-based workplace simulations with a pass threshold - practicing skills in a realistic scenario rather than isolated questions.

## 11.6 Peer Mesh (Human Knowledge Mesh)
The twin knows who just mastered a topic and who is a step behind, and pairs them for **peer teach-back** (learning by teaching). The seeker initiates; the mentor accepts; both mark completion. Requests are tracked **per mentor**.

## 11.7 Adversarial viva
After a coding submission, the learner must answer AI-generated questions about **their own** solution - a cheat-resistant check that they understand what they submitted.

## 11.8 Sovereign Learning Wallet
A signed, verifiable competence record. Signed with a wallet key (HS256 over the platform secret), it exposes a **public verify page** so an employer can confirm authenticity without an account. Certificates use readable ids (e.g. `LARE-VER-####`).

## 11.9 Proctoring & anti-cheat
Every page where a student submits an answer shows a **ProctorBanner** and reports integrity events (focus/tab/visibility) to the anticheat service, which flags anomalies for the exam session.

\newpage

# 12. Security & Compliance

| Control | Implementation |
|---|---|
| **Identity** | RS256 JWT: the auth service signs; the gateway + every service verify with the public key. Access + refresh tokens with de-duplicated silent refresh. |
| **Authorization** | Role guards (`require_roles`) + subject-ownership checks (a learner reads only their own data; cross-user ids return 403). |
| **Transport** | TLS/HTTPS end-to-end (Certbot). The SPA calls only `/api`; services bind to `127.0.0.1`. |
| **Data isolation** | One PostgreSQL schema per service; least-privilege `search_path`. |
| **No cross-user leakage** | The API client sends `cache: "no-store"`; production builds never render demo/fallback data (empty states instead), preventing one user's shape from showing to another. |
| **Exam integrity** | Proctoring + anti-cheat event capture on every answer-submission page; adversarial viva for coding. |
| **Audit** | Append-only audit trail of significant actions. |
| **Backups / DR** | RDS automated backups + point-in-time recovery. |
| **Secrets** | Kept in gitignored env files / key files; never committed. Rotate DB, JWT, AI, and SMTP secrets on schedule. |
| **Sandbox** | Code execution runs under subprocess/bubblewrap isolation. |

# 13. Deployment & Operations

## 13.1 Model
- **One EC2 box** runs Nginx + the gateway + all 26 services (as processes/systemd units); **RDS** hosts PostgreSQL. The SPA is built to static files and served by Nginx; `/api` reverse-proxies to the gateway.
- Scale later by moving Redis to ElastiCache and putting multiple EC2 app boxes behind a load balancer (services are stateless).

## 13.2 First-time setup (summary)
1. Provision RDS (PostgreSQL 16) and EC2 (Ubuntu), same VPC; lock RDS to the EC2 security group.
2. Install packages (Python, Node, Nginx, Redis optional, Postgres client, bubblewrap).
3. Clone the repo; create a Python venv; `pip install` base + per-service requirements + the editable `libs/` (`lare_common`).
4. Generate RS256 keys; fill `/backend/.env` (DATABASE_URL, JWT key files, AI keys, SMTP).
5. `init-db` per service (creates schemas/tables); apply column migrations.
6. Build the SPA and publish `dist` to the Nginx web root.
7. Configure Nginx (static + `/api` proxy) and TLS (Certbot).
8. Start all services; verify `/health`.

## 13.3 Redeploy after code changes
The repo ships `redeploy.sh` (pull -> restart backend -> rebuild + publish SPA):
- `./redeploy.sh` - full redeploy.
- `FRONTEND_ONLY=1 ./redeploy.sh` - UI-only change (build + publish + reload Nginx).
- `BACKEND_ONLY=1 ./redeploy.sh` - server-only change (restart services).
- `DEPS=1 ./redeploy.sh` - when dependencies changed (runs installs). `npm ci` also runs automatically if `node_modules` is missing.
Publishing copies the built `dist` into the Nginx web root (e.g. `/var/www/lare`) - building alone does not update what Nginx serves.

## 13.4 Operational notes learned in production
- **Python 3.14 compatibility**: pins for `psycopg`, `pydantic`, and `SQLAlchemy` were relaxed to versions shipping 3.14 wheels.
- **Low-RAM build**: add swap so the Vite build is not OOM-killed; build the SPA before starting the 26 services when RAM is tight.
- **Disk**: keep headroom for the venv + node build; grow the EBS volume rather than deleting OS files.
- **Binary downloads**: exports/PDFs refresh the token like any other call, so they survive an access-token expiry mid-session.

# 14. Roadmap - How to Extend

```
1) Scale storage       -> grow the disk (EBS) for content, media, logs
2) Enable code exec    -> add the coding sandbox (bubblewrap + language runtimes)
3) Add capacity        -> load balancer in front of multiple app servers
4) Speed at scale      -> managed Redis (ElastiCache) for the event bus + cache
5) Go global           -> CDN / edge caching for worldwide users
```

Further product directions: richer analytics, deeper AI evaluation, mobile-optimised take-flows, and expanded credential standards.

# 15. Appendices

## 15.1 Glossary
- **Cognitive Twin** - a per-learner skill profile fused from assessment + coding data.
- **Evaluation Twin** - the LARE Hire analogue built from drive-exam performance.
- **Micro-lesson** - an on-demand AI-generated lesson rendered as content blocks.
- **Adaptive drill** - a practice mode that tunes difficulty in real time.
- **Practice World** - a stepped, browser-based workplace simulation.
- **Peer Mesh** - AI-matched peer teach-back.
- **Sovereign Learning Wallet** - a signed, publicly verifiable competence record.
- **Adversarial viva** - AI questions that verify a learner understands their own solution.
- **Drive** - a recruitment campaign with roles, rounds, and results.
- **Envelope** - the `{ data, meta, errors }` JSON response shape.
- **Schema-per-service** - each microservice owns an isolated PostgreSQL schema.

## 15.2 Environment configuration (keys)
`DATABASE_URL`, `JWT_ALG=RS256`, `JWT_PRIVATE_KEY_FILE`, `JWT_PUBLIC_KEY_FILE`, `INTERNAL_JWT_SECRET`, `EVENT_BUS_BACKEND`, `REDIS_URL` (optional), `APP_ENV`, `EXEC_MODE`, `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `DRIVE_AI_PROVIDER`, `MISTRAL_API_KEY`, `AI_MAX_TOKENS`, `EMAIL_PROVIDER`, `SMTP_*`.

## 15.3 Demo access
- **Students**: `student01@lare.dev` .. `student30@lare.dev`, password `Lare@1234`. Seeded with activity across every feature.
- **Administrator**: provided via the secure credential store (kept out of this document); rotate before production.

> Security note: demo credentials are for evaluation only. Rotate all secrets (DB, JWT, AI, SMTP, admin) before any public launch.

## 15.4 Service/port/schema quick reference
See section 5.2. Ports `8001..8026` for services, `8000` for the gateway; schema = service name (`auth` -> `lare_auth`).

---

*End of document. Prepared for LARE Cloud Solutions - a unit of LARE Consulting & Technology Pvt. Ltd.*
