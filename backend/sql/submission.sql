-- ============================================================
-- Service schema: submission
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "submission";

CREATE TABLE IF NOT EXISTS submission.answer_latest (
	id VARCHAR NOT NULL, 
	session_id VARCHAR(64) NOT NULL, 
	question_id VARCHAR(64) NOT NULL, 
	response JSON NOT NULL, 
	client_seq INTEGER NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_latest UNIQUE (session_id, question_id)
);

CREATE TABLE IF NOT EXISTS submission.answers (
	id VARCHAR NOT NULL, 
	session_id VARCHAR(64) NOT NULL, 
	question_id VARCHAR(64) NOT NULL, 
	response JSON NOT NULL, 
	source VARCHAR(16) NOT NULL, 
	client_seq INTEGER NOT NULL, 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS submission.final_submissions (
	id VARCHAR NOT NULL, 
	session_id VARCHAR(64) NOT NULL, 
	snapshot JSON NOT NULL, 
	answer_count INTEGER NOT NULL, 
	submitted_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	finalized BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_final UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS submission.time_spent (
	id VARCHAR NOT NULL, 
	session_id VARCHAR(64) NOT NULL, 
	question_id VARCHAR(64) NOT NULL, 
	seconds INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_time UNIQUE (session_id, question_id)
);

