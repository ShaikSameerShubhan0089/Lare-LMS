-- ============================================================
-- Service schema: ai_tutor
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "ai_tutor";

CREATE TABLE IF NOT EXISTS ai_tutor.tutor_sessions (
	id VARCHAR(36) NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	title VARCHAR(160) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS ai_tutor.tutor_messages (
	id VARCHAR(36) NOT NULL, 
	session_id VARCHAR(36) NOT NULL, 
	role VARCHAR(16) NOT NULL, 
	content TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES ai_tutor.tutor_sessions (id)
);

