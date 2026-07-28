-- ============================================================
-- Service schema: questionbank
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "questionbank";

CREATE TABLE IF NOT EXISTS questionbank.blueprints (
	id VARCHAR NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	spec JSON NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS questionbank.questions (
	id VARCHAR NOT NULL, 
	type VARCHAR(16) NOT NULL, 
	category VARCHAR(16) NOT NULL, 
	difficulty VARCHAR(8) NOT NULL, 
	tags JSON NOT NULL, 
	stem VARCHAR(2048) NOT NULL, 
	options JSON NOT NULL, 
	answer_key JSON NOT NULL, 
	explanation VARCHAR(1024), 
	weight FLOAT NOT NULL, 
	version INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	author_id VARCHAR(64), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

