-- ============================================================
-- Service schema: result
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "result";

CREATE TABLE IF NOT EXISTS result.offers (
	id VARCHAR NOT NULL, 
	drive_id VARCHAR(64) NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	role_id VARCHAR(64), 
	type VARCHAR(8) NOT NULL, 
	company_name VARCHAR(255), 
	role_title VARCHAR(255), 
	ctc VARCHAR(64), 
	letter_file_id VARCHAR(64), 
	verify_id VARCHAR(64) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	issued_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS result.results (
	id VARCHAR NOT NULL, 
	drive_id VARCHAR(64) NOT NULL, 
	candidate_id VARCHAR(64) NOT NULL, 
	final_score FLOAT NOT NULL, 
	rank INTEGER, 
	outcome VARCHAR(16) NOT NULL, 
	status VARCHAR(12) NOT NULL, 
	published_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_result UNIQUE (drive_id, candidate_id)
);

