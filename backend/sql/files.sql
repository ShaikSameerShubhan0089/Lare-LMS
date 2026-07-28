-- ============================================================
-- Service schema: files
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "files";

CREATE TABLE IF NOT EXISTS files.files (
	id VARCHAR NOT NULL, 
	owner_user_id VARCHAR(64) NOT NULL, 
	purpose VARCHAR(32) NOT NULL, 
	bucket VARCHAR(64) NOT NULL, 
	object_key VARCHAR(128) NOT NULL, 
	filename VARCHAR(255), 
	mime VARCHAR(128) NOT NULL, 
	size INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	scan_result VARCHAR(32), 
	entity_type VARCHAR(32), 
	entity_id VARCHAR(64), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

