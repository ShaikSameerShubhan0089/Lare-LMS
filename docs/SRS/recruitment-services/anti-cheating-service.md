# SRS — Anti-Cheating (Proctoring) Service (Drive)

**Service ID:** `drive-anticheat` · **Domain:** Recruitment · **Version:** 1.0

---

## 1. Purpose
Preserve exam integrity by detecting, logging, and (optionally) acting on suspicious behavior during proctored assessments. Ingests browser/environment signals from the exam client, applies rules, raises warnings, notifies admins, and can trigger auto-submission via the Exam Engine. Every signal is timestamped and visible to administrators, feeding the drive integrity report.

## 2. Detected Signals
Tab switch · window blur/minimize · full-screen exit · page refresh/close attempt · copy · paste · right-click · developer-tools open (best-effort) · print-screen (best-effort) · multiple logins / multiple devices / multiple browsers · network disconnect · idle/inactivity timeout.

## 3. Logged Fields (per event)
Time · event type · IP · browser · device/fingerprint · user/session · exam · context/screenshot ref.

## 4. Actions
Warning (soft) · escalating warnings · admin notification · flag for review · auto-submit (via Exam Engine) on threshold.

## 5. Functional Requirements
| ID | Requirement |
|----|-------------|
| AC-1 | Ingest proctoring signals in real time (WebSocket/beacon) with dedupe + ordering. |
| AC-2 | Configurable rule engine: thresholds per signal → action (warn/notify/flag/auto-submit). |
| AC-3 | Enforce single active session; detect multiple logins/devices/browsers → flag/lock. |
| AC-4 | Record device fingerprint + IP + browser on session start and per event. |
| AC-5 | Capture periodic proctoring snapshots (if enabled) via File Service (short retention). |
| AC-6 | Trigger Exam Engine auto-submit when the violation threshold is crossed. |
| AC-7 | Real-time admin/proctor console feed of live flags. |
| AC-8 | Per-candidate integrity score + per-drive integrity report. |
| AC-9 | Every event written to Audit/Activity log (admin-visible). |

## 6. Data Model (`drive_anticheat` schema)
| Table | Key columns |
|-------|-------------|
| `proctor_sessions` | id, exam_session_id, candidate_id, fingerprint, ip, browser, started_at |
| `events` | id, proctor_session_id, type, ts, ip, browser, device, meta, snapshot_file_id |
| `rules` | id, drive_id, signal, threshold, action |
| `flags` | id, proctor_session_id, reason, severity, status, reviewed_by |
| `integrity_scores` | proctor_session_id, score, computed_at |

## 7. Key Endpoints
| Method | Path | Description |
|--------|------|-------------|
| WS/POST | `/drive/v1/proctor/{session}/events` | Ingest signals. |
| GET | `/drive/v1/proctor/{session}/summary` | Session integrity summary. |
| GET | `/drive/v1/drives/{id}/integrity` | Drive integrity report. |
| POST | `/drive/v1/anticheat/rules` (admin) | Configure rules/actions. |
| WS | `/drive/v1/proctor/live` | Admin live feed. |

## 8. Security & Privacy
- Snapshots restricted to proctor/admin, short retention, encrypted.
- Candidates informed of proctoring scope (consent/notice).
- Detections are advisory to a human decision; auto-submit is bounded and logged.
- Best-effort client detections (devtools/print-screen) never sole basis for disqualification.

## 9. Non-Functional
- Handle high-frequency event bursts across thousands of concurrent sessions.
- Action latency < 1 s from threshold breach to Exam Engine trigger.

## 10. Events
Consumes `exam.started`; publishes `anticheat.flagged`, `anticheat.action` → Exam Engine/Notification/Audit/Analytics.

## 11. Deployment (No Docker)
Gunicorn (gevent for WS) + Nginx (WS upgrade) + systemd `drive-anticheat.service` + ingestion worker. Redis for live session/device tracking; schema `drive_anticheat`.
