-- Apply to each customer database after migrations 018 and 019.
ALTER TABLE personnel_job_postings ADD COLUMN IF NOT EXISTS posting_duration_days integer NOT NULL DEFAULT 30;
ALTER TABLE personnel_job_postings ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE TABLE IF NOT EXISTS personnel_interviews (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 application_id text NOT NULL REFERENCES personnel_job_applications(id),
 scheduled_at timestamptz NOT NULL, interviewer text NOT NULL, notes text NOT NULL DEFAULT '',
 created_by text NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_personnel_interviews_customer_date ON personnel_interviews(customer_id,scheduled_at);
