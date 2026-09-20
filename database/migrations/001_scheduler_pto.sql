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

CREATE INDEX IF NOT EXISTS idx_schedule_entries_user_id
    ON schedule_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_schedule_entries_shift_date
    ON schedule_entries(shift_date);


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

CREATE INDEX IF NOT EXISTS idx_pto_requests_user_id
    ON pto_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_pto_requests_status
    ON pto_requests(status);

CREATE INDEX IF NOT EXISTS idx_pto_requests_dates
    ON pto_requests(start_date, end_date);