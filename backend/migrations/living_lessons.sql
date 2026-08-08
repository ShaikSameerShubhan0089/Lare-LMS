-- =============================================================================
-- Living Lessons — real, interactive lesson material (curriculum service).
-- Adds the lessons.content column (init-db can't add columns). Idempotent.
-- Local run-all schema is 'curriculum'; cloud default may differ — adjust.
-- =============================================================================
SET search_path TO curriculum;   -- or lms_curriculum, per your DB_SCHEMA

ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS content JSON NOT NULL DEFAULT '[]';

-- Deploy: run this (or `python services/curriculum/migrate_cols.py`), then
-- restart lms-curriculum + lare-gateway. NOTE: this release also FIXED a route
-- collision — the Generative "Micro-Lessons" feature moved from /lms/v1/lessons
-- to /lms/v1/micro-lessons so it no longer shadows the curriculum lesson routes.
-- Restart lms-assessment + lare-gateway for that too.
