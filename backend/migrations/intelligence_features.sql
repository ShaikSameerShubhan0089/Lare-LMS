-- =============================================================================
-- Intelligence features: Wallet, Flow (adaptive drill), Peer Mesh, Micro-Lessons
-- All in the assessment service (schema default: lms_assessment).
-- New TABLES are created by `cd backend/services/assessment && python manage.py init-db`.
-- The one new COLUMN (items.difficulty) needs the ALTER below.
-- Idempotent; safe to re-run.
-- =============================================================================
SET search_path TO lms_assessment;

-- Flow layer: difficulty drives the adaptive drill (init-db does not alter columns)
ALTER TABLE assessment_items
    ADD COLUMN IF NOT EXISTS difficulty VARCHAR(8) NOT NULL DEFAULT 'medium';

-- --- New tables (fallback DDL; normally created by manage.py init-db) --------
CREATE TABLE IF NOT EXISTS wallet_credentials (
    id            VARCHAR      PRIMARY KEY,
    learner_id    VARCHAR(64)  NOT NULL UNIQUE,
    verify_id     VARCHAR(64)  NOT NULL UNIQUE,
    subject_name  VARCHAR(255) NOT NULL DEFAULT '',
    payload       JSON         NOT NULL DEFAULT '{}',
    signature     VARCHAR      NOT NULL DEFAULT '',
    revoked       BOOLEAN      NOT NULL DEFAULT FALSE,
    issued_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drill_sessions (
    id             VARCHAR     PRIMARY KEY,
    learner_id     VARCHAR(64) NOT NULL,
    topic          VARCHAR(128),
    level          INTEGER     NOT NULL DEFAULT 1,
    served         JSON        NOT NULL DEFAULT '[]',
    pending_item_id VARCHAR(64),
    pending_since  TIMESTAMPTZ,
    correct_count  INTEGER     NOT NULL DEFAULT 0,
    total_count    INTEGER     NOT NULL DEFAULT 0,
    fast_count     INTEGER     NOT NULL DEFAULT 0,
    target         INTEGER     NOT NULL DEFAULT 8,
    status         VARCHAR(12) NOT NULL DEFAULT 'active',
    started_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_drill_learner ON drill_sessions (learner_id);

CREATE TABLE IF NOT EXISTS teach_sessions (
    id           VARCHAR      PRIMARY KEY,
    topic        VARCHAR(128) NOT NULL,
    teacher_id   VARCHAR(64)  NOT NULL,
    learner_id   VARCHAR(64)  NOT NULL,
    requested_by VARCHAR(64)  NOT NULL,
    status       VARCHAR(12)  NOT NULL DEFAULT 'requested',
    note         VARCHAR(512),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_teach_teacher ON teach_sessions (teacher_id);
CREATE INDEX IF NOT EXISTS ix_teach_learner ON teach_sessions (learner_id);

CREATE TABLE IF NOT EXISTS generated_lessons (
    id          VARCHAR      PRIMARY KEY,
    learner_id  VARCHAR(64)  NOT NULL,
    topic       VARCHAR(128) NOT NULL,
    lesson      JSON         NOT NULL DEFAULT '{}',
    generated   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_lesson_learner_topic UNIQUE (learner_id, topic)
);
CREATE INDEX IF NOT EXISTS ix_lessons_learner ON generated_lessons (learner_id);

-- Deploy: `manage.py init-db` (assessment) creates these tables; run the ALTER
-- above; restart lms-assessment + lare-gateway (new routes /lms/v1/wallet,
-- /lms/v1/drill, /lms/v1/mesh, /lms/v1/lessons, /verify/wallet). Optional:
-- WALLET_SIGNING_SECRET env (defaults to INTERNAL_JWT_SECRET) for credential
-- signing.
