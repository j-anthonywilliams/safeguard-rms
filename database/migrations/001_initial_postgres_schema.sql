CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER DEFAULT 0,
  password_hash TEXT,
  display_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  phone_verified INTEGER DEFAULT 0,
  role TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_sign_in TEXT NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  archived_by TEXT
);

CREATE TABLE IF NOT EXISTS app_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'supervisor', 'admin', 'support', 'backend')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_user_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  requested_role TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_at TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  accuracy REAL
);

CREATE TABLE IF NOT EXISTS case_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  case_number TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  lead_officer TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  report_number TEXT NOT NULL,
  incident_date TEXT NOT NULL,
  location TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  subject_phone TEXT,
  subject_dob TEXT,
  violent_flag INTEGER NOT NULL DEFAULT 0,
  ban_bar_flag INTEGER NOT NULL DEFAULT 0,
  incident_codes TEXT NOT NULL,
  disposition TEXT NOT NULL,
  narrative TEXT NOT NULL,
  created_at TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'Pending',
  approved_by TEXT,
  approved_at TEXT,
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  zip_code TEXT NOT NULL DEFAULT '',
  case_file_id TEXT,
  parent_incident_id TEXT,
  report_type TEXT NOT NULL DEFAULT 'Original',
  review_feedback TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_number TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'In custody',
  created_at TEXT NOT NULL,
  incident_id TEXT
);

CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Available',
  assigned_to TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custody_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT,
  event_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pto_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pto_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_roles_user_id
  ON app_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_users_is_archived
  ON users(is_archived);

CREATE INDEX IF NOT EXISTS idx_incidents_user_id
  ON incidents(user_id);

CREATE INDEX IF NOT EXISTS idx_incidents_report_number
  ON incidents(report_number);

CREATE INDEX IF NOT EXISTS idx_evidence_incident_id
  ON evidence(incident_id);

CREATE INDEX IF NOT EXISTS idx_custody_events_evidence_id
  ON custody_events(evidence_id);

CREATE INDEX IF NOT EXISTS idx_schedule_entries_user_id
  ON schedule_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_pto_requests_user_id
  ON pto_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_id
  ON attendance_logs(user_id);