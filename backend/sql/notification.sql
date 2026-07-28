-- ============================================================
-- Service schema: notification
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "notification";

CREATE TABLE IF NOT EXISTS notification.notifications (
	id VARCHAR NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	template_key VARCHAR(64) NOT NULL, 
	channel VARCHAR(16) NOT NULL, 
	payload JSON NOT NULL, 
	subject VARCHAR(255), 
	body VARCHAR(4096) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	dedupe_key VARCHAR(128), 
	read_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	sent_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS notification.preferences (
	id VARCHAR NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	channel VARCHAR(16) NOT NULL, 
	enabled BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_preference UNIQUE (user_id, channel)
);

CREATE TABLE IF NOT EXISTS notification.templates (
	id VARCHAR NOT NULL, 
	key VARCHAR(64) NOT NULL, 
	channel VARCHAR(16) NOT NULL, 
	locale VARCHAR(8) NOT NULL, 
	subject VARCHAR(255), 
	body VARCHAR(4096) NOT NULL, 
	version INTEGER NOT NULL, 
	active BOOLEAN NOT NULL, 
	critical BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_template UNIQUE (key, channel, locale)
);

