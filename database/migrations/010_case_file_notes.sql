-- Apply to each customer database before using Case File notes.
CREATE TABLE IF NOT EXISTS case_file_notes (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  case_file_id TEXT NOT NULL REFERENCES case_files(id),
  author_id TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_case_file_notes_scope ON case_file_notes (customer_id, case_file_id, created_at);
