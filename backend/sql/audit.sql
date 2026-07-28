-- ============================================================
-- Service schema: audit
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "audit";

CREATE TABLE IF NOT EXISTS audit.activity_logs (
	id VARCHAR NOT NULL, 
	user_id VARCHAR(64), 
	session_id VARCHAR(64), 
	event VARCHAR(64) NOT NULL, 
	context JSON NOT NULL, 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS audit.audit_logs (
	id VARCHAR NOT NULL, 
	partition_key VARCHAR(64) NOT NULL, 
	seq INTEGER NOT NULL, 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	actor_type VARCHAR(16) NOT NULL, 
	actor_id VARCHAR(64), 
	action VARCHAR(64) NOT NULL, 
	entity_type VARCHAR(32), 
	entity_id VARCHAR(64), 
	meta JSON NOT NULL, 
	ip VARCHAR(64), 
	device VARCHAR(128), 
	correlation_id VARCHAR(64), 
	prev_hash VARCHAR(64), 
	hash VARCHAR(64) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_audit_seq UNIQUE (partition_key, seq)
);

