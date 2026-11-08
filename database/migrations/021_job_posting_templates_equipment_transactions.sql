-- Customer-scoped reusable job posting templates and equipment custody transactions.
CREATE TABLE IF NOT EXISTS personnel_job_posting_templates (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 name text NOT NULL, description text NOT NULL DEFAULT '', qualifications text NOT NULL DEFAULT '',
 location text NOT NULL DEFAULT '', employment_type text NOT NULL DEFAULT '',
 compensation text NOT NULL DEFAULT '', onboarding_job_title text NOT NULL DEFAULT '',
 posting_duration_days integer NOT NULL DEFAULT 30 CHECK(posting_duration_days BETWEEN 1 AND 365),
 created_by text NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 archived_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_job_templates_customer ON personnel_job_posting_templates(customer_id,archived_at);
CREATE TABLE IF NOT EXISTS equipment_transactions (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 equipment_id text NOT NULL REFERENCES equipment(id), action text NOT NULL CHECK(action IN ('issue','return')),
 employee_id text REFERENCES users(id), actor_id text NOT NULL REFERENCES users(id),
 condition_note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipment_transactions_customer ON equipment_transactions(customer_id,equipment_id,created_at);
