
-- SafeGuard-RMS
-- Migration 004: Customer Organizational Foundation
-- Additive migration: preserves existing RMS records.

BEGIN;

-- One customer identity per dedicated customer database.
CREATE TABLE customer_settings (
    id TEXT PRIMARY KEY,
    customer_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    website_slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT customer_status_check
        CHECK (status IN ('active', 'suspended', 'inactive'))
);

-- Clients belonging to the customer.
CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL
        REFERENCES customer_settings(id),
    client_code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (customer_id, client_code),
    UNIQUE (customer_id, id)
);

-- Sites belonging to clients.
CREATE TABLE sites (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    site_code TEXT NOT NULL,
    name TEXT NOT NULL,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (customer_id, client_id)
        REFERENCES clients(customer_id, id),
    UNIQUE (customer_id, site_code),
    UNIQUE (customer_id, client_id, id)
);

-- Optional customer assignments.
CREATE TABLE user_customer_assignments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    customer_id TEXT NOT NULL
        REFERENCES customer_settings(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, customer_id)
);

-- Optional client assignments.
CREATE TABLE user_client_assignments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    customer_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (customer_id, client_id)
        REFERENCES clients(customer_id, id),
    UNIQUE (user_id, client_id)
);

-- Optional site assignments.
CREATE TABLE user_site_assignments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    customer_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (customer_id, client_id, site_id)
        REFERENCES sites(customer_id, client_id, id),
    UNIQUE (user_id, site_id)
);

-- Annual report numbering across the entire customer.
CREATE TABLE customer_report_sequences (
    customer_id TEXT NOT NULL
        REFERENCES customer_settings(id),
    report_year INTEGER NOT NULL,
    last_sequence INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (customer_id, report_year),
    CHECK (report_year BETWEEN 2000 AND 9999),
    CHECK (last_sequence BETWEEN 0 AND 9999)
);

-- Indexes for organizational lookups.
CREATE INDEX idx_clients_customer
    ON clients(customer_id);

CREATE INDEX idx_sites_client
    ON sites(client_id);

CREATE INDEX idx_user_customer_assignments_user
    ON user_customer_assignments(user_id);

CREATE INDEX idx_user_client_assignments_user
    ON user_client_assignments(user_id);

CREATE INDEX idx_user_site_assignments_user
    ON user_site_assignments(user_id);

COMMIT;
