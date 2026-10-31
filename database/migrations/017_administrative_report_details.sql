-- Apply to each customer database after 015_personnel_report_approval_stages.sql.
ALTER TABLE personnel_administrative_reports
 ADD COLUMN IF NOT EXISTS incident_date date,
 ADD COLUMN IF NOT EXISTS report_reason text NOT NULL DEFAULT 'administrative',
 ADD COLUMN IF NOT EXISTS other_reason text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS incident_location text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS involved_person text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS witnesses text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS actions_taken text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS incident_id text;
CREATE INDEX IF NOT EXISTS idx_personnel_admin_incident ON personnel_administrative_reports(customer_id,incident_id);
