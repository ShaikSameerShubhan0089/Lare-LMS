-- ============================================================
-- Service schema: evaluation
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "evaluation";

CREATE TABLE IF NOT EXISTS evaluation.answer_keys (
	exam_id VARCHAR(64) NOT NULL, 
	items JSON NOT NULL, 
	passing_pct INTEGER NOT NULL, 
	negative_marking FLOAT NOT NULL, 
	PRIMARY KEY (exam_id)
);

CREATE TABLE IF NOT EXISTS evaluation.evaluations (
	id VARCHAR NOT NULL, 
	exam_id VARCHAR(64) NOT NULL, 
	session_id VARCHAR(64) NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	total FLOAT NOT NULL, 
	max_score FLOAT NOT NULL, 
	percentage FLOAT NOT NULL, 
	accuracy FLOAT NOT NULL, 
	passed BOOLEAN NOT NULL, 
	version INTEGER NOT NULL, 
	question_scores JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_eval_session UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS evaluation.ranks (
	id VARCHAR NOT NULL, 
	exam_id VARCHAR(64) NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	rank INTEGER NOT NULL, 
	percentage FLOAT NOT NULL, 
	tie_break VARCHAR(128), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_rank UNIQUE (exam_id, candidate_id)
);

