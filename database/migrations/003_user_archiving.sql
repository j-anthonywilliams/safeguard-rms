ALTER TABLE users ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN archived_at TEXT;
ALTER TABLE users ADD COLUMN archived_by TEXT;

CREATE INDEX IF NOT EXISTS idx_users_is_archived
  ON users(is_archived);