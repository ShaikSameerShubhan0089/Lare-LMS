-- ============================================================
-- Service schema: coding
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "coding";

CREATE TABLE IF NOT EXISTS coding.coding_sessions (
	id VARCHAR NOT NULL, 
	problem_id VARCHAR(64) NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	exam_session_id VARCHAR(64), 
	language VARCHAR(16) NOT NULL, 
	draft_code VARCHAR NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS coding.coding_submissions (
	id VARCHAR NOT NULL, 
	coding_session_id VARCHAR(64) NOT NULL, 
	code VARCHAR NOT NULL, 
	score FLOAT NOT NULL, 
	cases_passed INTEGER NOT NULL, 
	total_cases INTEGER NOT NULL, 
	detail JSON NOT NULL, 
	submitted_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS coding.problems (
	id VARCHAR NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	statement VARCHAR(4096) NOT NULL, 
	languages JSON NOT NULL, 
	time_limit_sec INTEGER NOT NULL, 
	memory_limit_mb INTEGER NOT NULL, 
	sample_cases JSON NOT NULL, 
	hidden_cases JSON NOT NULL, 
	max_score FLOAT NOT NULL, 
	PRIMARY KEY (id)
);

