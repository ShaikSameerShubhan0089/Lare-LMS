-- ============================================================
-- Service schema: anticheat
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "anticheat";

CREATE TABLE IF NOT EXISTS anticheat.events (
	id VARCHAR NOT NULL, 
	proctor_session_id VARCHAR(64) NOT NULL, 
	type VARCHAR(32) NOT NULL, 
	weight INTEGER NOT NULL, 
	ip VARCHAR(64), 
	browser VARCHAR(128), 
	device VARCHAR(128), 
	meta JSON NOT NULL, 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS anticheat.proctor_sessions (
	id VARCHAR NOT NULL, 
	exam_session_id VARCHAR(64) NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	drive_id VARCHAR(64), 
	fingerprint VARCHAR(128), 
	ip VARCHAR(64), 
	browser VARCHAR(128), 
	violation_score INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

