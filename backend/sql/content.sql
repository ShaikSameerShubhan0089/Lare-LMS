-- ============================================================
-- Service schema: content
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "content";

CREATE TABLE IF NOT EXISTS content.consumption (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	content_item_id VARCHAR(64) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	position_sec INTEGER NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_consumption UNIQUE (learner_id, content_item_id)
);

CREATE TABLE IF NOT EXISTS content.content_items (
	id VARCHAR NOT NULL, 
	lesson_id VARCHAR(64) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	type VARCHAR(16) NOT NULL, 
	file_id VARCHAR(64), 
	url VARCHAR(512), 
	duration_sec INTEGER NOT NULL, 
	difficulty VARCHAR(16) NOT NULL, 
	"order" INTEGER NOT NULL, 
	objectives JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS content.gates (
	id VARCHAR NOT NULL, 
	content_item_id VARCHAR NOT NULL, 
	rule_type VARCHAR(32) NOT NULL, 
	rule_config JSON NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(content_item_id) REFERENCES content.content_items (id) ON DELETE CASCADE
);

