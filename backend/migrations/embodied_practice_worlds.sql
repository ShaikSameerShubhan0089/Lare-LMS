-- =============================================================================
-- Embodied Practice Worlds — browser workplace simulations (assessment service).
-- New TABLES are created by `cd backend/services/assessment && python manage.py init-db`.
-- No column changes. This DDL is a fallback (safe to run). Schema: lms_assessment.
-- =============================================================================
SET search_path TO lms_assessment;

CREATE TABLE IF NOT EXISTS practice_worlds (
    id          VARCHAR      PRIMARY KEY,
    title       VARCHAR(160) NOT NULL,
    role        VARCHAR(80)  NOT NULL DEFAULT '',
    skill       VARCHAR(80)  NOT NULL DEFAULT '',
    difficulty  VARCHAR(8)   NOT NULL DEFAULT 'medium',
    summary     VARCHAR(512),
    steps       JSON         NOT NULL DEFAULT '[]',
    pass_pct    INTEGER      NOT NULL DEFAULT 60,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_runs (
    id            VARCHAR     PRIMARY KEY,
    world_id      VARCHAR(64) NOT NULL,
    learner_id    VARCHAR(64) NOT NULL,
    step_index    INTEGER     NOT NULL DEFAULT 0,
    answers       JSON        NOT NULL DEFAULT '{}',
    correct_count INTEGER     NOT NULL DEFAULT 0,
    score         DOUBLE PRECISION NOT NULL DEFAULT 0,
    status        VARCHAR(12) NOT NULL DEFAULT 'in_progress',
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_world_runs_world   ON world_runs (world_id);
CREATE INDEX IF NOT EXISTS ix_world_runs_learner ON world_runs (learner_id);

-- Deploy:
--   cd backend/services/assessment && python manage.py init-db     (creates tables)
--   DB_SCHEMA=assessment PYTHONPATH=. <venv>/bin/python seed_worlds.py  (3 scenarios)
--   restart lms-assessment + lare-gateway (new route /lms/v1/worlds)
