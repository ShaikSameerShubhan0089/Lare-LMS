# SRS — Content Delivery Service (LMS)

**Service ID:** `lms-content` · **Domain:** LMS · **Version:** 1.0

---

## 1. Purpose
Serve learning content — videos, slides, PDFs, readings, interactive exercises, and links — mapped to curriculum lessons, and drive the gamified, "mesmerising" learner experience. Handles content authoring metadata, sequencing, gating (prerequisites), and AI-personalized recommendations of what to learn next.

## 2. Responsibilities
- Register content items (stored via File Service) and bind them to lessons/objectives.
- Sequence and gate content (unlock rules, prerequisites, mastery gates).
- Track content consumption events (started, progressed, completed) → Progress.
- Serve a personalized learner "home": current module, streak nudges, recommended next item (via AI Orchestration `content.recommend`).
- Support interactive item types (quizzes-in-lesson delegate to Assessment; coding practice delegates to Coding).
- Multi-format delivery with signed URLs and resumable video position.

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| CT-1 | CRUD content items with type, duration, file ref, objectives, difficulty. |
| CT-2 | Define unlock/prerequisite rules and mastery gates. |
| CT-3 | Serve learner playlist for current cohort/year respecting gates. |
| CT-4 | Emit consumption events (heartbeat every N s for video) with resume position. |
| CT-5 | Personalized next-best recommendation via AI Orchestration, grounded in scorecard + objectives. |
| CT-6 | Deliver content only to enrolled, gated-eligible learners via signed URLs. |
| CT-7 | Gamified surfacing: progress rings, XP-on-complete signals to Gamification. |

## 4. Data Model (`lms_content` schema)
| Table | Key columns |
|-------|-------------|
| `content_items` | id, lesson_id, type(video/pdf/slide/reading/interactive/link), file_id, duration, difficulty, objectives |
| `gates` | id, content_item_id, rule_type, rule_config |
| `consumption` | id, learner_id, content_item_id, status, position, updated_at |
| `recommendations` | id, learner_id, content_item_id, reason, score, created_at |

## 5. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST/GET | `/lms/v1/content` | Manage items. |
| GET | `/lms/v1/learners/{id}/playlist` | Current gated playlist. |
| POST | `/lms/v1/content/{id}/progress` | Consumption heartbeat. |
| GET | `/lms/v1/learners/{id}/recommendations` | Next-best items. |
| GET | `/lms/v1/content/{id}/play` | Signed play URL + resume. |

## 6. Security
- Content served only to eligible learners; signed, expiring URLs (File Service).
- Trainers/designers author; students consume.

## 7. Non-Functional
- Video resume accurate; consumption events durable and idempotent.
- Recommendations degrade to rule-based ordering if AI unavailable.

## 8. Events
`content.completed`, `content.progressed` → Progress/Gamification/Analytics; consumes `curriculum.published`.

## 9. Deployment (No Docker)
Gunicorn (gevent for heartbeats) + Nginx; systemd `lms-content.service`. Schema `lms_content`; assets in Supabase Storage.
