# Intelligence features — deploy notes

Four complete LARE Learn features (all local; nothing pushed or deployed):

| Feature | What it is |
|---|---|
| **Sovereign Learning Wallet** (`/lms/wallet`) | A signed, learner-owned competence credential with a **public verify page** (`/verify/wallet/<id>` — no login) + PDF/JSON export + revoke. |
| **Flow layer — Adaptive Drill** (`/lms/drill`) | One-question-at-a-time MCQ drill that raises/eases difficulty from live accuracy + response speed; feeds the twin & review schedule. |
| **Human Knowledge Mesh — Peer Mesh** (`/lms/mesh`) | Matches a learner weak on a topic with a peer strong on it; seeker requests → mentor accepts. Weak peers are never named. |
| **Generative Learning Fabric — Micro-Lessons** (`/lms/lessons`) | On-demand AI lesson for any concept (intro, key points, worked example, common trap, practice), saved to a personal library. |

## Deploy
```bash
# 1. New tables (wallet_credentials, drill_sessions, teach_sessions, generated_lessons)
cd backend/services/assessment && python manage.py init-db
# 2. New column (assessment_items.difficulty) — init-db does not alter columns
psql "$DATABASE_URL" -f backend/migrations/intelligence_features.sql
# 3. Frontend
cd frontend && npm run build
# 4. Restart
#    lms-assessment  (all four features live here)
#    lare-gateway    (new routes: /lms/v1/wallet, /lms/v1/drill, /lms/v1/mesh,
#                     /lms/v1/lessons, /verify/wallet)
```

## Notes
- **Wallet signing:** set `WALLET_SIGNING_SECRET` (falls back to `INTERNAL_JWT_SECRET`).
  Verification is server-authoritative (tamper + revoke are rejected); the RS256/
  blockchain-anchored upgrade is the documented future step.
- **Adaptive Drill** needs MCQ items with a `difficulty` set — new items get a
  Difficulty selector in Trainer Console; existing items default to `medium`.
- **Micro-Lessons** use the LMS AI (Gemini via `AI_PROVIDER`); a rule-based
  fallback returns a full lesson if AI is unavailable, so the page always works.
- **Peer Mesh** matches platform-wide from assessment data; cohort-scoping is a
  future refinement.
- **Item.difficulty** and all four tables are additive/safe; rollback = redeploy
  the previous build.
