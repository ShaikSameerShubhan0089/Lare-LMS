-- ============================================================
-- Service schema: organization
-- Generated from SQLAlchemy models (PostgreSQL dialect).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS "organization";

CREATE TABLE IF NOT EXISTS organization.organizations (
	id VARCHAR(36) NOT NULL, 
	tenant_id VARCHAR(64) NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	slug VARCHAR(80) NOT NULL, 
	custom_domain VARCHAR(200), 
	timezone VARCHAR(48) NOT NULL, 
	branding JSON NOT NULL, 
	smtp_config JSON NOT NULL, 
	security_policy JSON NOT NULL, 
	feature_overrides JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	archived BOOLEAN NOT NULL, 
	pii_erased BOOLEAN NOT NULL, 
	PRIMARY KEY (id)
);

