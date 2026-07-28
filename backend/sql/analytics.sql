-- ============================================================
-- Service schema: analytics
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "analytics";

CREATE TABLE IF NOT EXISTS analytics.dashboard_layouts (
	user_id VARCHAR(64) NOT NULL, 
	widgets JSON NOT NULL, 
	PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS analytics.facts (
	id VARCHAR NOT NULL, 
	kind VARCHAR(16) NOT NULL, 
	college_id VARCHAR(64), 
	cohort_id VARCHAR(64), 
	learner_id VARCHAR(64), 
	drive_id VARCHAR(64), 
	metric VARCHAR(32) NOT NULL, 
	value FLOAT NOT NULL, 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

