-- P2 personnel workflows. Apply to each customer database, not the platform database.
CREATE TABLE IF NOT EXISTS personnel_training_classes (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 title text NOT NULL, description text NOT NULL DEFAULT '', prerequisites text NOT NULL DEFAULT '',
 content text NOT NULL DEFAULT '', recurrence_days integer, expiration_days integer,
 passing_score integer, created_by text NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (recurrence_days IS NULL OR recurrence_days > 0),
 CHECK (expiration_days IS NULL OR expiration_days > 0),
 CHECK (passing_score IS NULL OR passing_score BETWEEN 0 AND 100)
);
CREATE TABLE IF NOT EXISTS personnel_training_assignments (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 class_id text NOT NULL REFERENCES personnel_training_classes(id), user_id text NOT NULL REFERENCES users(id),
 status text NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','completed')),
 completed_at timestamptz, verified_by text REFERENCES users(id), assigned_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(customer_id,class_id,user_id)
);
CREATE TABLE IF NOT EXISTS personnel_candidates (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 user_id text NOT NULL REFERENCES users(id), full_name text NOT NULL, email text NOT NULL,
 stage text NOT NULL DEFAULT 'onboarding', created_by text NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(customer_id,user_id)
);
CREATE TABLE IF NOT EXISTS personnel_onboarding_steps (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 candidate_id text NOT NULL REFERENCES personnel_candidates(id), title text NOT NULL,
 completed_at timestamptz, completed_by text REFERENCES users(id), notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS personnel_administrative_reports (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 subject_user_id text REFERENCES users(id), author_id text NOT NULL REFERENCES users(id),
 title text NOT NULL, narrative text NOT NULL, status text NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','approved','rejected')),
 reviewer_id text REFERENCES users(id), review_note text, reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS personnel_time_off_requests (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 user_id text NOT NULL REFERENCES users(id), start_date date NOT NULL, end_date date NOT NULL,
 reason text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','approved','rejected')),
 reviewer_id text REFERENCES users(id), review_note text, reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(end_date >= start_date)
);
CREATE TABLE IF NOT EXISTS personnel_workflow_audit (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 actor_id text NOT NULL REFERENCES users(id), record_type text NOT NULL, record_id text NOT NULL,
 action text NOT NULL, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_training_customer ON personnel_training_classes(customer_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_customer ON personnel_training_assignments(customer_id,user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_customer ON personnel_candidates(customer_id);
CREATE INDEX IF NOT EXISTS idx_personnel_reports_customer ON personnel_administrative_reports(customer_id);
CREATE INDEX IF NOT EXISTS idx_timeoff_customer ON personnel_time_off_requests(customer_id);
