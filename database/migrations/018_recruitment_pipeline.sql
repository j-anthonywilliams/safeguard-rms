-- P2 applicant tracking: run against each customer database.
CREATE TABLE IF NOT EXISTS personnel_job_postings (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 slug text NOT NULL, title text NOT NULL, description text NOT NULL DEFAULT '',
 qualifications text NOT NULL DEFAULT '', location text NOT NULL DEFAULT '',
 employment_type text NOT NULL DEFAULT '', compensation text NOT NULL DEFAULT '',
 onboarding_job_title text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','closed','archived')),
 created_by text NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(customer_id,slug)
);
CREATE TABLE IF NOT EXISTS personnel_job_applications (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 posting_id text NOT NULL REFERENCES personnel_job_postings(id),
 candidate_id text NOT NULL REFERENCES personnel_candidates(id),
 stage text NOT NULL DEFAULT 'application_received',
 disposition text NOT NULL DEFAULT 'active' CHECK(disposition IN ('active','deferred','rejected','hired')),
 cover_note text NOT NULL DEFAULT '',
 internal_reason text NOT NULL DEFAULT '', follow_up_on date,
 updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(posting_id,candidate_id)
);
CREATE TABLE IF NOT EXISTS personnel_application_events (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 application_id text NOT NULL REFERENCES personnel_job_applications(id),
 actor_id text REFERENCES users(id), action text NOT NULL,
 from_stage text, to_stage text, note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_applications_customer ON personnel_job_applications(customer_id,disposition,stage);
CREATE INDEX IF NOT EXISTS idx_job_postings_public ON personnel_job_postings(customer_id,status,slug);
