# SRS — AI Tutor Service (LMS)

**Service ID:** `lms-ai-tutor` · **Domain:** LMS · **Version:** 1.0
**AI backend:** via AI Orchestration Service (`claude-opus-4-8`).

---

## 1. Purpose
The learner-facing AI mentor that makes the LMS "AI-integrated". Provides Socratic, context-grounded tutoring, doubt-solving, guided practice, stream-selection counselling support, and personalized study planning. It is a thin, learning-aware service that composes context (current lesson, scorecard, objectives) and calls the AI Orchestration Service; it never calls the model directly.

## 2. Responsibilities
- Conversational tutoring grounded in the learner's current module/lesson and objectives.
- Doubt resolution with guided hints (never leaks exam answers).
- Personalized study plan generation from the skill scorecard and year goals.
- Stream-selection guidance (Year 2) blending aptitude results + interests (advisory to mentor).
- Practice generation (practice questions/exercises) routed to Assessment/Coding.
- Conversation memory per learner (bounded, privacy-aware) for continuity.
- Escalation to a human trainer when the learner is stuck or requests it.

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| TU-1 | Streamed chat tutor grounded in current lesson context (SSE to frontend). |
| TU-2 | Compose grounding context: lesson, objectives, recent scorecard — minimize PII. |
| TU-3 | Never reveal live assessment/exam answers; enforced via system prompt + content policy. |
| TU-4 | Generate a personalized weekly study plan tied to weak scorecard dimensions. |
| TU-5 | Stream-selection helper: summarize aptitude+interest signals into a recommendation for mentor confirmation. |
| TU-6 | Maintain per-learner conversation threads with bounded history/summary. |
| TU-7 | Human escalation: create a mentor task/notification when triggered. |
| TU-8 | All tutoring calls logged via AI Orchestration (model + prompt version) to Audit. |

## 4. Data Model (`lms_ai_tutor` schema)
| Table | Key columns |
|-------|-------------|
| `threads` | id, learner_id, context_ref, title, created_at |
| `messages` | id, thread_id, role, content, tokens, ts |
| `study_plans` | id, learner_id, week, items(json), rationale, created_at |
| `escalations` | id, learner_id, thread_id, reason, mentor_user_id, status |

## 5. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/lms/v1/tutor/threads` | Start a tutoring thread. |
| POST | `/lms/v1/tutor/threads/{id}/message` | Send message → SSE stream. |
| GET | `/lms/v1/tutor/threads/{id}` | Thread history. |
| POST | `/lms/v1/tutor/study-plan` | Generate study plan. |
| POST | `/lms/v1/tutor/stream-advice` | Stream-selection guidance. |
| POST | `/lms/v1/tutor/escalate` | Escalate to mentor. |

## 6. Security & Governance
- Untrusted learner text delimited; injection attempts ignored (handled in AI Orchestration).
- No secrets/PII beyond what grounding needs; conversation retention configurable.
- Advisory only for stream selection and study plans; mentor confirms formal decisions.

## 7. Non-Functional
- First token < 3 s (P95); graceful fallback message if AI unavailable (LMS keeps working).
- Bounded context/history to control token cost (summarize old turns).

## 8. Events
`tutor.session.completed`, `tutor.escalated`, `studyplan.created` → Progress/Notification/Analytics.

## 9. Deployment (No Docker)
Gunicorn (gevent for SSE) + Nginx; systemd `lms-ai-tutor.service`. Calls `lare-ai`; schema `lms_ai_tutor`.
