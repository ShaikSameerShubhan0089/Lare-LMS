# LARE Unified Skilling & Recruitment Platform — Documentation

Production-level SRS for a **single platform** with two major applications sharing one microservices backbone (Python Flask, React + Vite + Tailwind, Supabase PostgreSQL, JWT, AI via Claude `claude-opus-4-8`). **No Docker** — each service runs as an independent Gunicorn process under systemd behind Nginx.

- **LARE LMS** — AI-integrated, gamified Learning Management System delivering the 4-Year Training & Placement Programme; produces the "best college" readiness analytics.
- **LARE Drive** — Online Campus Recruitment & Assessment (drive conducting) platform: proctored exams, coding, evaluation, interviews, offers/PPO.

## Start here
→ **[Master SRS](SRS/00-SRS-Master.md)** — scope, architecture, standards, deployment, traceability, and the full service index.

## Service specifications (one file per microservice)

### Shared services
| Service | Spec |
|---|---|
| API Gateway | [api-gateway.md](SRS/shared-services/api-gateway.md) |
| Auth & Authorization | [auth-service.md](SRS/shared-services/auth-service.md) |
| Notification | [notification-service.md](SRS/shared-services/notification-service.md) |
| File & Storage | [file-storage-service.md](SRS/shared-services/file-storage-service.md) |
| Analytics | [analytics-service.md](SRS/shared-services/analytics-service.md) |
| Audit | [audit-service.md](SRS/shared-services/audit-service.md) |
| AI Orchestration | [ai-orchestration-service.md](SRS/shared-services/ai-orchestration-service.md) |

### LMS services
| Service | Spec |
|---|---|
| Institution | [institution-service.md](SRS/lms-services/institution-service.md) |
| Learner | [learner-service.md](SRS/lms-services/learner-service.md) |
| Curriculum | [curriculum-service.md](SRS/lms-services/curriculum-service.md) |
| Content Delivery | [content-delivery-service.md](SRS/lms-services/content-delivery-service.md) |
| Assessment | [assessment-service.md](SRS/lms-services/assessment-service.md) |
| Progress Tracking | [progress-tracking-service.md](SRS/lms-services/progress-tracking-service.md) |
| Gamification | [gamification-service.md](SRS/lms-services/gamification-service.md) |
| AI Tutor | [ai-tutor-service.md](SRS/lms-services/ai-tutor-service.md) |
| Certification | [certification-service.md](SRS/lms-services/certification-service.md) |

### Recruitment (Drive) services
| Service | Spec |
|---|---|
| Candidate | [candidate-service.md](SRS/recruitment-services/candidate-service.md) |
| Recruitment Drive | [drive-service.md](SRS/recruitment-services/drive-service.md) |
| Question Bank | [question-bank-service.md](SRS/recruitment-services/question-bank-service.md) |
| Exam Engine | [exam-engine-service.md](SRS/recruitment-services/exam-engine-service.md) |
| Anti-Cheating (Proctoring) | [anti-cheating-service.md](SRS/recruitment-services/anti-cheating-service.md) |
| Coding Assessment | [coding-assessment-service.md](SRS/recruitment-services/coding-assessment-service.md) |
| Submission | [submission-service.md](SRS/recruitment-services/submission-service.md) |
| Evaluation | [evaluation-service.md](SRS/recruitment-services/evaluation-service.md) |
| Interview | [interview-service.md](SRS/recruitment-services/interview-service.md) |
| Result & Offer | [result-service.md](SRS/recruitment-services/result-service.md) |

---
*Confidential — LARE IT Cloud Solutions.*
