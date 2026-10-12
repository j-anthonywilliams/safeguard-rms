
-- SafeGuard-RMS
-- Migration 005: Organizational references
-- Additive migration; existing records are preserved.

BEGIN;

ALTER TABLE incidents
  ADD COLUMN customer_id TEXT,
  ADD COLUMN client_id TEXT,
  ADD COLUMN site_id TEXT;

ALTER TABLE case_files
  ADD COLUMN customer_id TEXT,
  ADD COLUMN client_id TEXT,
  ADD COLUMN site_id TEXT;

ALTER TABLE evidence
  ADD COLUMN customer_id TEXT,
  ADD COLUMN client_id TEXT,
  ADD COLUMN site_id TEXT;

ALTER TABLE equipment
  ADD COLUMN customer_id TEXT,
  ADD COLUMN client_id TEXT,
  ADD COLUMN site_id TEXT;

ALTER TABLE attendance_logs
  ADD COLUMN customer_id TEXT,
  ADD COLUMN client_id TEXT,
  ADD COLUMN site_id TEXT;

ALTER TABLE schedule_entries
  ADD COLUMN customer_id TEXT,
  ADD COLUMN client_id TEXT,
  ADD COLUMN site_id TEXT;

ALTER TABLE pto_requests
  ADD COLUMN customer_id TEXT,
  ADD COLUMN client_id TEXT,
  ADD COLUMN site_id TEXT;

COMMIT;
