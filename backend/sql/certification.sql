-- ============================================================
-- Service schema: certification
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "certification";

CREATE TABLE IF NOT EXISTS certification.certificates (
	id VARCHAR NOT NULL, 
	learner_id VARCHAR(64) NOT NULL, 
	year_no INTEGER NOT NULL, 
	template_id VARCHAR(64), 
	cert_no VARCHAR(64) NOT NULL, 
	cert_name VARCHAR(255) NOT NULL, 
	verify_id VARCHAR(64) NOT NULL, 
	file_id VARCHAR(64), 
	status VARCHAR(16) NOT NULL, 
	ppo_tag BOOLEAN NOT NULL, 
	holder_name VARCHAR(255), 
	issued_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_cert UNIQUE (learner_id, year_no), 
	UNIQUE (cert_no)
);

CREATE TABLE IF NOT EXISTS certification.templates (
	id VARCHAR NOT NULL, 
	year_no INTEGER NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	signatories VARCHAR(512), 
	version INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_template_year UNIQUE (year_no)
);

CREATE TABLE IF NOT EXISTS certification.revocations (
	id VARCHAR NOT NULL, 
	certificate_id VARCHAR NOT NULL, 
	reason VARCHAR(512), 
	revoked_by VARCHAR(64), 
	ts TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(certificate_id) REFERENCES certification.certificates (id) ON DELETE CASCADE
);

