-- ============================================================
-- Service schema: gamification
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "gamification";

CREATE TABLE IF NOT EXISTS gamification.badges (
	id VARCHAR NOT NULL, 
	code VARCHAR(64) NOT NULL, 
	name VARCHAR(128) NOT NULL, 
	description VARCHAR(255), 
	icon VARCHAR(64), 
	PRIMARY KEY (id), 
	UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS gamification.learner_badges (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	badge_code VARCHAR(64) NOT NULL, 
	earned_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_learner_badge UNIQUE (learner_id, badge_code)
);

CREATE TABLE IF NOT EXISTS gamification.levels (
	learner_id VARCHAR(64) NOT NULL, 
	total_xp INTEGER NOT NULL, 
	level INTEGER NOT NULL, 
	display_name VARCHAR(120), 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (learner_id)
);

CREATE TABLE IF NOT EXISTS gamification.streaks (
	learner_id VARCHAR(64) NOT NULL, 
	current INTEGER NOT NULL, 
	longest INTEGER NOT NULL, 
	last_active_day DATE, 
	freezes INTEGER NOT NULL, 
	PRIMARY KEY (learner_id)
);

CREATE TABLE IF NOT EXISTS gamification.xp_ledger (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	action VARCHAR(64) NOT NULL, 
	points INTEGER NOT NULL, 
	source_event_id VARCHAR(96), 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_xp_event UNIQUE (learner_id, source_event_id)
);

