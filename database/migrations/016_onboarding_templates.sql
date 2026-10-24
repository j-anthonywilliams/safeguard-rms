-- Apply after 014_personnel_workflows.sql to each customer database.
CREATE TABLE IF NOT EXISTS personnel_onboarding_templates (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 name text NOT NULL, job_title text, active boolean NOT NULL DEFAULT true,
 created_by text NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_onboarding_master ON personnel_onboarding_templates(customer_id) WHERE active AND job_title IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_onboarding_job ON personnel_onboarding_templates(customer_id,lower(job_title)) WHERE active AND job_title IS NOT NULL;
CREATE TABLE IF NOT EXISTS personnel_onboarding_template_requirements (
 id text PRIMARY KEY, template_id text NOT NULL REFERENCES personnel_onboarding_templates(id),
 title text NOT NULL, kind text NOT NULL CHECK(kind IN ('physical','document','certification','background_check','training','other')),
 required boolean NOT NULL DEFAULT true, position integer NOT NULL DEFAULT 0
);
ALTER TABLE personnel_candidates ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE personnel_onboarding_steps ADD COLUMN IF NOT EXISTS requirement_kind text NOT NULL DEFAULT 'other';
ALTER TABLE personnel_onboarding_steps ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT true;
ALTER TABLE personnel_onboarding_steps ADD COLUMN IF NOT EXISTS source_template_id text REFERENCES personnel_onboarding_templates(id);
CREATE INDEX IF NOT EXISTS idx_onboarding_templates_customer ON personnel_onboarding_templates(customer_id,active);
