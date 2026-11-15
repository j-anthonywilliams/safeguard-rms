-- Customer-scoped contract rates, worked-time reconciliation and export profiles.
CREATE TABLE IF NOT EXISTS billing_contracts (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 name text NOT NULL, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(customer_id,name)
);
CREATE TABLE IF NOT EXISTS billing_contract_rates (
 id text PRIMARY KEY, contract_id text NOT NULL REFERENCES billing_contracts(id),
 classification text NOT NULL CHECK(classification IN ('officer','supervisor','manager')),
 billing_rate numeric(12,2) NOT NULL CHECK(billing_rate>=0),
 effective_from date NOT NULL, effective_to date,
 CHECK(effective_to IS NULL OR effective_to>=effective_from),
 UNIQUE(contract_id,classification,effective_from)
);
CREATE TABLE IF NOT EXISTS payroll_contract_pay_rates (
 id text PRIMARY KEY, contract_id text NOT NULL REFERENCES billing_contracts(id),
 employee_id text NOT NULL REFERENCES users(id), pay_rate numeric(12,2) NOT NULL CHECK(pay_rate>=0),
 effective_from date NOT NULL, effective_to date,
 CHECK(effective_to IS NULL OR effective_to>=effective_from),
 UNIQUE(contract_id,employee_id,effective_from)
);
CREATE TABLE IF NOT EXISTS payroll_work_entries (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 contract_id text NOT NULL REFERENCES billing_contracts(id),
 employee_id text NOT NULL REFERENCES users(id), work_date date NOT NULL,
 classification text NOT NULL CHECK(classification IN ('officer','supervisor','manager')),
 actual_hours numeric(8,2) NOT NULL CHECK(actual_hours>=0 AND actual_hours<=24),
 billable_hours numeric(8,2) NOT NULL CHECK(billable_hours>=0 AND billable_hours<=24),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved')),
 notes text NOT NULL DEFAULT '', created_by text NOT NULL REFERENCES users(id),
 approved_by text REFERENCES users(id), approved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_work_period ON payroll_work_entries(customer_id,work_date,status);
CREATE TABLE IF NOT EXISTS payroll_export_profiles (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 name text NOT NULL, kind text NOT NULL CHECK(kind IN ('payroll','billing')),
 destination text NOT NULL DEFAULT 'standalone',
 columns jsonb NOT NULL, delimiter text NOT NULL DEFAULT ',',
 include_header boolean NOT NULL DEFAULT true,
 date_format text NOT NULL DEFAULT 'iso' CHECK(date_format IN ('iso','us')),
 created_by text NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(customer_id,name,kind)
);
