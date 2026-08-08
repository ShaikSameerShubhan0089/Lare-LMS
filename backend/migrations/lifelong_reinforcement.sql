-- =============================================================================
-- Lifelong Reinforcement (Keep Sharp) — forgetting-aware spaced review.
-- The review_items table is created automatically by
--   cd backend/services/assessment && python manage.py init-db
-- This file is a fallback (safe to run). Schema default: lms_assessment.
-- =============================================================================
SET search_path TO lms_assessment;

CREATE TABLE IF NOT EXISTS review_items (
    id                VARCHAR      PRIMARY KEY,
    learner_id        VARCHAR(64)  NOT NULL,
    skill             VARCHAR(128) NOT NULL,
    source            VARCHAR(16)  NOT NULL DEFAULT 'written',
    interval_days     DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    ease              DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    review_count      INTEGER      NOT NULL DEFAULT 0,
    last_mastery      DOUBLE PRECISION NOT NULL DEFAULT 0,
    last_reviewed_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    due_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_review_learner_skill UNIQUE (learner_id, skill)
);
CREATE INDEX IF NOT EXISTS ix_review_items_learner ON review_items (learner_id);
CREATE INDEX IF NOT EXISTS ix_review_items_due     ON review_items (due_at);

-- Deploy: `manage.py init-db` (assessment) creates this table; restart
-- lms-assessment and lare-gateway (new route /lms/v1/reviews). No seed needed —
-- items are created lazily from each learner's skill twin, and refreshed
-- automatically whenever they submit an assessment.
