-- ============================================================
-- Service schema: ai_orchestration
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "ai_orchestration";

CREATE TABLE IF NOT EXISTS ai_orchestration.ai_calls (
	id VARCHAR(36) NOT NULL, 
	prompt_key VARCHAR(64) NOT NULL, 
	purpose VARCHAR(64) NOT NULL, 
	actor_id VARCHAR(64) NOT NULL, 
	model VARCHAR(64) NOT NULL, 
	mode VARCHAR(16) NOT NULL, 
	input_tokens INTEGER NOT NULL, 
	output_tokens INTEGER NOT NULL, 
	latency_ms INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	preview TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

