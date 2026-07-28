-- ============================================================
-- Service schema: curriculum
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "curriculum";

CREATE TABLE IF NOT EXISTS curriculum.curricula (
	id VARCHAR NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	version INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS curriculum.cohort_curriculum (
	id VARCHAR NOT NULL, 
	cohort_id VARCHAR(64) NOT NULL, 
	curriculum_id VARCHAR NOT NULL, 
	effective_from DATE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(curriculum_id) REFERENCES curriculum.curricula (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum.year_tracks (
	id VARCHAR NOT NULL, 
	curriculum_id VARCHAR NOT NULL, 
	year_no INTEGER NOT NULL, 
	theme VARCHAR(255), 
	goal VARCHAR(512), 
	PRIMARY KEY (id), 
	CONSTRAINT uq_year UNIQUE (curriculum_id, year_no), 
	FOREIGN KEY(curriculum_id) REFERENCES curriculum.curricula (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum.modules (
	id VARCHAR NOT NULL, 
	year_track_id VARCHAR NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	"order" INTEGER NOT NULL, 
	branch_scope VARCHAR(32) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(year_track_id) REFERENCES curriculum.year_tracks (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum.outcome_checks (
	id VARCHAR NOT NULL, 
	year_track_id VARCHAR NOT NULL, 
	statement VARCHAR(512) NOT NULL, 
	criteria VARCHAR(512), 
	PRIMARY KEY (id), 
	FOREIGN KEY(year_track_id) REFERENCES curriculum.year_tracks (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum.lessons (
	id VARCHAR NOT NULL, 
	module_id VARCHAR NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	"order" INTEGER NOT NULL, 
	content_ref VARCHAR(128), 
	PRIMARY KEY (id), 
	FOREIGN KEY(module_id) REFERENCES curriculum.modules (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum.objectives (
	id VARCHAR NOT NULL, 
	lesson_id VARCHAR NOT NULL, 
	statement VARCHAR(512) NOT NULL, 
	skill_tag VARCHAR(64), 
	PRIMARY KEY (id), 
	FOREIGN KEY(lesson_id) REFERENCES curriculum.lessons (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curriculum.item_objective_map (
	id VARCHAR NOT NULL, 
	objective_id VARCHAR NOT NULL, 
	item_type VARCHAR(16) NOT NULL, 
	item_id VARCHAR(64) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(objective_id) REFERENCES curriculum.objectives (id) ON DELETE CASCADE
);

