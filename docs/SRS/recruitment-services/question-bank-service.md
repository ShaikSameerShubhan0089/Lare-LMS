# SRS — Question Bank Service (Drive)

**Service ID:** `drive-questionbank` · **Domain:** Recruitment · **Version:** 1.0

---

## 1. Purpose
Central repository of assessment items across aptitude, technical, verbal, and programming categories, with rich typing, difficulty, tagging, versioning, and randomization support. Feeds the Exam Engine and Coding Assessment services, and is reusable by the LMS Assessment service. Supports AI-assisted item generation (human-reviewed).

## 2. Responsibilities
- Store questions of many types: MCQ, multi-select, fill-in-the-blank, match-the-following, true/false, coding, SQL query, output prediction.
- Categorize (aptitude/technical/verbal/programming), tag by topic, and set difficulty.
- Version items and answer keys; maintain author, review status, usage stats.
- Support randomization pools and blueprint-based paper generation.
- Bulk upload/import and AI-draft generation via AI Orchestration (`question.generate`).
- Maintain hidden vs sample test cases for coding/SQL items (linked to Coding service).

## 3. Question Types
MCQ · Multi-select · Fill-in-the-blank · Match-the-following · True/False · Coding · SQL query · Output prediction.

## 4. Functional Requirements
| ID | Requirement |
|----|-------------|
| QB-1 | CRUD items with type-specific schema, answer key, explanation, difficulty, tags, category. |
| QB-2 | Versioning: edits create new versions; keys are immutable once used in a live exam. |
| QB-3 | Bulk import (CSV/Excel/JSON) with validation + preview. |
| QB-4 | AI-assisted generation (drafts) with mandatory human review before activation. |
| QB-5 | Randomization pools + blueprint generation (N per category/difficulty). |
| QB-6 | Coding/SQL items reference test-case sets (sample + hidden) held for the Coding service. |
| QB-7 | Usage & difficulty stats fed from Evaluation (question difficulty index). |
| QB-8 | Secure item access: exam-time items never exposed with keys to clients. |

## 5. Data Model (`drive_questionbank` schema)
| Table | Key columns |
|-------|-------------|
| `questions` | id, type, category, difficulty, tags, stem, version, status, author_id |
| `question_options` | id, question_id, text, is_correct, order |
| `answer_keys` | question_id, key(json), explanation |
| `coding_meta` | question_id, languages, time_limit, memory_limit, testcase_set_id |
| `blueprints` | id, name, spec(json) |
| `usage_stats` | question_id, attempts, correct, difficulty_index |

## 6. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST/GET | `/drive/v1/questions` | Manage items. |
| POST | `/drive/v1/questions/bulk` | Bulk import. |
| POST | `/drive/v1/questions/generate` | AI draft generation. |
| POST | `/drive/v1/blueprints/{id}/generate-paper` | Paper from blueprint. |
| GET | `/drive/v1/questions/{id}` | Item (keys hidden per role). |

## 7. Security
- Answer keys restricted to authors/exam engine; never sent to candidate clients.
- AI drafts require human activation; all edits audited.

## 8. Non-Functional
- Fast randomized paper generation for large concurrent drives.
- Item bank scales to hundreds of thousands of items.

## 9. Events
`question.created`, `question.activated`, `paper.generated` → Exam Engine/Coding/Analytics.

## 10. Deployment (No Docker)
Gunicorn + Nginx; systemd `drive-questionbank.service`. Schema `drive_questionbank`.
