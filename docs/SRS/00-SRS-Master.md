# Software Requirements Specification (SRS)

## LARE Unified Skilling & Recruitment Platform

**Prepared by:** LARE IT Cloud Solutions
**Version:** 1.0
**Date:** 21 July 2026
**Status:** Baseline for Engineering
**Classification:** Confidential

---

## 0. About This Document

This is the **master SRS** for a single platform composed of **two major applications** that share one microservices backbone, one identity system, one database cluster, and one deployment model:

| # | Application | Codename | Purpose |
|---|-------------|----------|---------|
| A | **LARE LMS** | `lare-lms` | AI-integrated Learning Management System delivering the 4-Year Structured Training & Placement Programme to colleges, with gamified frontends and per-student skill tracking. |
| B | **LARE Drive** | `lare-drive` | Online Campus Recruitment & Assessment Platform (drive conducting) — question banks, proctored exams, coding assessments, evaluation, interviews, offers. |

The two applications are **not** separate products; they are two bounded domains of one platform. A student who completes the LMS Year 4 track flows directly into a recruitment drive without re-registering. Shared services (Auth, Notification, Analytics, Audit, File Storage, API Gateway) serve both.

Each microservice has its **own detailed SRS file**. This master document defines cross-cutting concerns, the service map, shared standards, and traceability. Read this first, then the per-service files.

> **Design principle (per client requirement):** No Docker. Each Flask microservice is deployed as an independent OS process managed by a process supervisor (systemd / Windows Service / Supervisor), fronted by Nginx and Gunicorn. See §9.

---

## 1. Document Index

### Shared Services (`/shared-services`)
- [API Gateway](shared-services/api-gateway.md)
- [Auth Service](shared-services/auth-service.md)
- [Notification Service](shared-services/notification-service.md)
- [File & Storage Service](shared-services/file-storage-service.md)
- [Analytics Service](shared-services/analytics-service.md)
- [Audit Service](shared-services/audit-service.md)
- [AI Orchestration Service](shared-services/ai-orchestration-service.md)

### LMS Services (`/lms-services`)
- [Institution Service](lms-services/institution-service.md)
- [Learner Service](lms-services/learner-service.md)
- [Curriculum Service](lms-services/curriculum-service.md)
- [Content Delivery Service](lms-services/content-delivery-service.md)
- [Assessment Service](lms-services/assessment-service.md)
- [Progress Tracking Service](lms-services/progress-tracking-service.md)
- [Gamification Service](lms-services/gamification-service.md)
- [AI Tutor Service](lms-services/ai-tutor-service.md)
- [Certification Service](lms-services/certification-service.md)

### Recruitment (Drive) Services (`/recruitment-services`)
- [Candidate Service](recruitment-services/candidate-service.md)
- [Drive Service](recruitment-services/drive-service.md)
- [Question Bank Service](recruitment-services/question-bank-service.md)
- [Exam Engine Service](recruitment-services/exam-engine-service.md)
- [Anti-Cheating Service](recruitment-services/anti-cheating-service.md)
- [Coding Assessment Service](recruitment-services/coding-assessment-service.md)
- [Submission Service](recruitment-services/submission-service.md)
- [Evaluation Service](recruitment-services/evaluation-service.md)
- [Interview Service](recruitment-services/interview-service.md)
- [Result Service](recruitment-services/result-service.md)

---

## 2. Purpose & Scope

### 2.1 Purpose
Deliver a production-grade SaaS platform that lets LARE IT Cloud Solutions:
1. Run a **4-year, branch-wise, LMS-tracked training programme** across partner colleges (starting with Aditya College of Engineering, Madanapalle), with AI-driven personalization and gamified engagement.
2. Conduct **end-to-end recruitment drives** — from eligibility filtering through proctored online assessments, coding rounds, automated evaluation, interview management, and offer generation.
3. Give colleges a **"best college" scorecard** — measurable, LMS-tracked readiness and placement analytics usable for NAAC/NBA documentation.

### 2.2 In Scope
- Multi-tenant, multi-college onboarding.
- Year-wise curriculum (Years 1–4) with domain tracks for CSE/allied and core branches.
- LMS attendance, assessment, skill scorecard, year-wise certification.
- AI tutor, AI content recommendation, AI-assisted evaluation, AI feedback generation.
- Gamification (XP, levels, badges, streaks, leaderboards).
- Recruitment drives, question banks, proctored exams, coding IDE, anti-cheating, auto-evaluation, interview scheduling, results, offer letters.
- Role-based dashboards for Super Admin, Company Admin, College Admin/TPO, Recruiter/Interviewer, Trainer, Student/Candidate.

### 2.3 Out of Scope (v1)
- Mobile native apps (responsive web only; PWA optional).
- SMS/WhatsApp channels (designed for, not delivered — see Notification Service).
- Payment gateway / billing automation (programme fee handled offline per MoU).
- On-prem college-hosted deployment (cloud SaaS only in v1).

---

## 3. Stakeholders & Actors

| Actor | Application | Description |
|-------|-------------|-------------|
| Super Admin | Both | LARE platform owner; manages tenants, colleges, drives, config, global analytics. |
| Company Admin | Drive (+LMS visibility) | LARE recruitment/programme owner; creates drives, question banks, offers. |
| College Admin / TPO | Both | College coordinator; onboards students, schedules, views results. |
| Trainer / Faculty Mentor | LMS | Delivers modules, grades subjective work, mentors stream selection. |
| Recruiter / Interviewer | Drive | Conducts interviews, rates candidates, recommends selection. |
| Student | LMS | Learner across the 4-year programme. |
| Candidate | Drive | Same person as Student, in recruitment context (top performers routed to Lare Consulting & Technologies Pvt. Ltd. PPO pipeline). |
| System (AI) | Both | Claude-powered tutoring, recommendation, evaluation, feedback. |

> A single physical person holds one **user** identity (Auth Service) and may carry both a **learner** profile (LMS) and a **candidate** profile (Drive).

---

## 4. Platform Architecture Overview

```
                         ┌──────────────────────────────┐
                         │  Frontend (React + Vite +     │
                         │  Tailwind, gamified UI, PWA)  │
                         └───────────────┬──────────────┘
                                         │ HTTPS / JWT
                         ┌───────────────▼──────────────┐
                         │        API Gateway            │
                         │ (routing, JWT verify, rate    │
                         │  limit, CORS, versioning)     │
                         └───────────────┬──────────────┘
        ┌────────────────────────────────┼────────────────────────────────┐
        │              SHARED SERVICES                                     │
        │  Auth · Notification · File/Storage · Analytics · Audit · AI     │
        └────────────────┬───────────────────────────────┬────────────────┘
                         │                                 │
        ┌────────────────▼─────────────┐   ┌──────────────▼───────────────┐
        │        LMS DOMAIN             │   │      DRIVE DOMAIN            │
        │  Institution · Learner ·      │   │  Candidate · Drive ·        │
        │  Curriculum · Content ·       │   │  QuestionBank · ExamEngine ·│
        │  Assessment · Progress ·      │   │  AntiCheat · Coding ·       │
        │  Gamification · AI Tutor ·    │   │  Submission · Evaluation ·  │
        │  Certification                │   │  Interview · Result         │
        └────────────────┬─────────────┘   └──────────────┬──────────────┘
                         │                                 │
                         └───────────────┬─────────────────┘
                                         │
                         ┌───────────────▼──────────────┐
                         │  Supabase PostgreSQL cluster  │
                         │  (schema-per-domain) +        │
                         │  Supabase Storage + Redis     │
                         └──────────────────────────────┘
```

### 4.1 Service Communication
- **North–south:** Frontend → API Gateway → service (synchronous REST/JSON).
- **East–west (sync):** service → service via internal REST over the private network, authenticated with short-lived service tokens minted by Auth.
- **East–west (async):** domain events published to a lightweight broker (Redis Streams in v1; upgradeable to a managed queue) for `event.*` fan-out (e.g. `exam.submitted` → Evaluation, Analytics, Audit, Notification).
- Every service owns its data; **no cross-service direct DB access.** A service reads another domain's data only through that domain's API or a published event.

---

## 5. Technology Stack (Platform-wide)

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React 18 + Vite + Tailwind CSS | Gamified, animation-rich, responsive; PWA-capable. |
| State/Data | TanStack Query + Zustand | Server cache + local UI state. |
| Backend | Python 3.11 + Flask (one app per service) | REST APIs, blueprint-structured. |
| API style | REST/JSON, OpenAPI 3.1 per service | Contract-first. |
| ORM | SQLAlchemy 2.x + Alembic | Migrations per service schema. |
| Database | Supabase PostgreSQL | Schema-per-domain; RLS for tenant isolation. |
| Cache/Queue | Redis (cache, rate limits, Redis Streams events) | Optional but recommended. |
| Object storage | Supabase Storage | Resumes, photos, certificates, content, code artifacts. |
| Auth | JWT (access + refresh), RBAC | Central Auth Service. |
| AI | Anthropic Claude (`claude-opus-4-8`) via official `anthropic` Python SDK | See AI Orchestration Service. |
| Email | SMTP / Brevo | Via Notification Service. |
| Realtime | Server-Sent Events (SSE) + WebSocket (exam, proctoring, leaderboards) | |
| Deployment | Gunicorn + Nginx + systemd/Supervisor | **No Docker.** See §9. |
| Observability | Structured JSON logs → central log store; Prometheus metrics; health endpoints | |

---

## 6. Cross-Cutting Standards

### 6.1 API Conventions
- Base path per service: `/{service}/v{n}/...`; the Gateway exposes `/api/v1/...`.
- All responses: `{ "data": ..., "meta": {...}, "errors": [...] }`.
- Errors use RFC 7807-style problem objects with a stable `code`.
- Pagination: cursor-based (`?limit=&cursor=`); list responses return `meta.next_cursor`.
- Idempotency: mutating endpoints accept `Idempotency-Key` header where retries are likely (submissions, offers).
- Timestamps: ISO-8601 UTC. All dates stored UTC; rendered in college timezone (Asia/Kolkata default).

### 6.2 Identity & Multi-Tenancy
- `tenant_id` (LARE org) and `college_id` on every domain row.
- Postgres Row-Level Security enforces tenant + college isolation; the app also filters defensively.
- One user, many roles; roles scoped to a college where relevant (a TPO of College X is not TPO of College Y).

### 6.3 Security Baseline (applies to all services)
- JWT access tokens (15 min) + rotating refresh tokens (7 days, httpOnly cookie).
- RBAC + resource-level authorization checks in every handler.
- bcrypt (cost ≥ 12) for passwords; Argon2id acceptable.
- HTTPS/TLS everywhere; HSTS at Nginx.
- CORS allowlist per environment.
- Rate limiting at Gateway + per-service sensitive endpoints.
- Parameterized queries only (SQLAlchemy); no string-built SQL.
- Output encoding + CSP for XSS; CSRF tokens on cookie-auth browser flows.
- Signed, expiring URLs for all storage objects (resumes, certificates, code).
- Full audit trail via Audit Service (§ Audit).
- Secrets in environment/secret manager, never in code or VCS.

### 6.4 AI Governance
- AI is **assistive**, never the sole decision-maker for pass/fail, selection, or certification. A human (trainer/recruiter) confirms high-stakes outcomes.
- All AI inputs/outputs for evaluation and feedback are logged (Audit) with model ID and prompt version.
- Student PII sent to the model is minimized; no secrets or credentials are ever sent.
- Prompt-injection defenses: untrusted student text is clearly delimited and never treated as instructions.

---

## 7. Non-Functional Requirements (Platform)

| Category | Requirement |
|----------|-------------|
| Availability | 99.5% monthly for core exam & LMS paths; graceful degradation of AI/gamification. |
| Exam concurrency | ≥ 5,000 concurrent candidates in one drive without submission loss. |
| Auto-save | Exam answers auto-saved ≤ every 10 s and on every answer change. |
| Latency | P95 API < 400 ms (non-AI); AI endpoints stream, first token < 3 s. |
| Durability | Zero accepted-submission loss; append-only submission log. |
| Scalability | Horizontal scale by running more Gunicorn workers/instances per service behind Nginx. |
| Recoverability | Nightly DB backups + PITR; exam sessions resumable after client crash/network loss. |
| Accessibility | WCAG 2.1 AA for learner/candidate-facing pages. |
| Localization | English v1; i18n-ready copy. |
| Data retention | Student data retained per MoU; deletion/export on request (privacy). |

---

## 8. Data Architecture

- **Schema-per-domain** in one Supabase PostgreSQL cluster: `auth`, `lms_*`, `drive_*`, `shared_*`.
- Cross-domain references are by **stable UUID keys**, resolved via APIs/events — not foreign keys across schemas.
- Canonical tables per service are defined in each service's SRS. The consolidated table catalog appears in each file's "Data Model" section.
- Read models / analytics use materialized views and a denormalized reporting schema fed by events (Analytics Service).

---

## 9. Deployment Model (No Docker)

Each microservice is an independent deployable unit:

```
/opt/lare/<service>/
  ├── app/                  # Flask application (blueprints)
  ├── venv/                 # per-service Python virtualenv
  ├── gunicorn.conf.py      # workers = 2*cores+1, gevent/uvicorn workers for SSE
  ├── .env                  # service config (never in VCS)
  └── alembic/              # migrations
```

- **Process supervision:** one `systemd` unit per service (`lare-auth.service`, `lare-exam-engine.service`, …). On Windows hosts, NSSM/Windows Service wrappers.
- **Serving:** Gunicorn bound to a local port; **Nginx** reverse-proxies and terminates TLS, routing `/api/v1/*` to the Gateway which routes onward.
- **Scaling:** add Gunicorn workers or additional service instances on new hosts; Nginx `upstream` load-balances.
- **Zero-downtime deploys:** blue/green via two systemd instances + Nginx upstream swap; DB migrations are backward-compatible (expand/contract).
- **Config:** 12-factor env vars; secrets from the host secret store.
- **CI/CD:** build venv + run tests + Alembic upgrade + graceful `systemctl reload`.

---

## 10. Master Requirement Traceability (high level)

| Programme/Business need (from MoU) | Realized by |
|------------------------------------|-------------|
| 4-year branch-wise curriculum | Curriculum + Content + Institution services |
| LMS attendance & module tracking | Progress Tracking + Learner services |
| Skill scorecard (comm/coding/aptitude/project) | Progress Tracking + Assessment + Analytics |
| Year-wise auto certificates | Certification Service |
| Aptitude/NQT-pattern & company exams | Question Bank + Exam Engine + Coding |
| Placement pipeline / PPO to Lare Consulting | Drive + Interview + Result services |
| Anti-cheating & integrity | Anti-Cheating Service |
| "Best college" analytics for NAAC/NBA | Analytics Service |
| Gamified, "mesmerising" engagement | Gamification + frontend |
| AI-integrated LMS | AI Tutor + AI Orchestration + Recommendation |

---

## 11. Glossary

| Term | Meaning |
|------|---------|
| Drive | A recruitment campaign for a company/role across one or more colleges. |
| Cohort | A branch+year group progressing through the programme together. |
| PPO | Pre-Placement Offer (via Lare Consulting and Technologies Pvt. Ltd.). |
| NQT | National Qualifier Test (e.g., TCS NQT) exam pattern. |
| Skill Scorecard | Per-student dashboard of communication, coding, aptitude, project scores. |
| XP / Streak / Badge | Gamification primitives (Gamification Service). |
| Stream | Chosen specialization (AI/ML, Data Science, Web, Cybersecurity, Cloud). |

---

*End of master SRS. Proceed to the per-service specifications listed in §1.*
