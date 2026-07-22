# SRS — Gamification Service (LMS)

**Service ID:** `lms-gamification` · **Domain:** LMS · **Version:** 1.0

---

## 1. Purpose
Power the "mesmerising", gamified learner experience the platform is meant to feel like. Turns learning actions into XP, levels, badges, streaks, quests, and leaderboards — increasing engagement and completion. It listens to progress events and rewards them, then feeds motivational surfaces on the frontend.

## 2. Responsibilities
- Award XP for defined actions (complete content, pass assessment, maintain streak, help peers).
- Manage levels and level-up thresholds.
- Issue badges/achievements (rule-based) and milestone rewards.
- Track daily/weekly streaks and streak-freeze mechanics.
- Define quests/challenges (time-bound goals) per cohort/year.
- Maintain leaderboards (cohort, branch, college, global) with privacy controls.
- Emit celebratory events (level-up, badge) for in-app/email notifications.

## 3. Functional Requirements
| ID | Requirement |
|----|-------------|
| GM-1 | Rule engine maps events → XP with configurable weights and anti-abuse caps. |
| GM-2 | Levels with thresholds; compute level from cumulative XP. |
| GM-3 | Badge rules (e.g., "7-day streak", "DSA I complete", "First deploy"). |
| GM-4 | Streak tracking with timezone-aware day boundaries + freezes. |
| GM-5 | Quests/challenges with start/end, criteria, rewards. |
| GM-6 | Leaderboards with scope + opt-out; anti-cheat (dedupe, rate caps). |
| GM-7 | Real-time leaderboard/XP updates via SSE/WebSocket. |
| GM-8 | Idempotent awarding keyed by source event id. |

## 4. Data Model (`lms_gamification` schema)
| Table | Key columns |
|-------|-------------|
| `xp_ledger` | id, learner_id, action, points, source_event_id, ts |
| `levels` | learner_id, level, total_xp, updated_at |
| `badges` | id, code, name, criteria, icon |
| `learner_badges` | learner_id, badge_id, earned_at |
| `streaks` | learner_id, current, longest, last_active_day, freezes |
| `quests` | id, scope, title, criteria, start, end, reward |
| `quest_progress` | quest_id, learner_id, progress, completed_at |
| `leaderboard_optout` | learner_id |

## 5. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/lms/v1/learners/{id}/game` | XP, level, badges, streak. |
| GET | `/lms/v1/leaderboards/{scope}` | Leaderboard. |
| GET | `/lms/v1/quests` | Active quests. |
| POST | `/lms/v1/gamification/rules` (admin) | Configure XP/badge rules. |
| GET | `/lms/v1/game/stream` | SSE real-time updates. |

## 6. Security
- Awarding is server-side only from trusted events; clients cannot self-award.
- Leaderboard respects opt-out and shows minimal PII (display name/avatar).

## 7. Non-Functional
- Awarding latency < 1 s from event; leaderboards cached + incrementally updated.
- Anti-abuse: per-action daily caps, dedupe on source event.

## 8. Events
Consumes `content.completed`, `assessment.scored`, `year.completed`, etc. Publishes `gamification.xp_awarded`, `badge.earned`, `level_up` → Notification/Analytics.

## 9. Deployment (No Docker)
Gunicorn (gevent for SSE) + Nginx; systemd `lms-gamification.service` + rule worker. Redis for leaderboards (sorted sets) + real-time; schema `lms_gamification`.
