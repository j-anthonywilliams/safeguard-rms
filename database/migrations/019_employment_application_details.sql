-- Extended employment application fields; no medical or voluntary demographic data stored here.
ALTER TABLE personnel_job_applications ADD COLUMN IF NOT EXISTS application_data jsonb;
