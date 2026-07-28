-- ============================================================
-- Service schema: progress
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "progress";

CREATE TABLE IF NOT EXISTS progress.attendance (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	schedule_slot_id VARCHAR(64) NOT NULL, 
	status VARCHAR(8) NOT NULL, 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS progress.module_progress (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	module_id VARCHAR(64) NOT NULL, 
	completion_pct FLOAT NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_module_progress UNIQUE (learner_id, module_id)
);

CREATE TABLE IF NOT EXISTS progress.score_events (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	year_no INTEGER NOT NULL, 
	dimension VARCHAR(16) NOT NULL, 
	value FLOAT NOT NULL, 
	source VARCHAR(64), 
	ref_id VARCHAR(64), 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS progress.scorecard (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	year_no INTEGER NOT NULL, 
	communication FLOAT NOT NULL, 
	coding FLOAT NOT NULL, 
	aptitude FLOAT NOT NULL, 
	project FLOAT NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_scorecard UNIQUE (learner_id, year_no)
);

CREATE TABLE IF NOT EXISTS progress.year_status (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	year_no INTEGER NOT NULL, 
	criteria_met BOOLEAN NOT NULL, 
	attendance_pct FLOAT NOT NULL, 
	avg_score FLOAT NOT NULL, 
	computed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_year_status UNIQUE (learner_id, year_no)
);

