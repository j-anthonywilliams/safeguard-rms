-- Apply after 014_personnel_workflows.sql to each customer database.
ALTER TABLE personnel_administrative_reports
  DROP CONSTRAINT IF EXISTS personnel_administrative_reports_status_check;
ALTER TABLE personnel_administrative_reports
  ADD CONSTRAINT personnel_administrative_reports_status_check
  CHECK (status IN ('pending','pending_manager','approved','rejected'));
