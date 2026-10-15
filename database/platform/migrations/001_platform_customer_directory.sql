
-- SafeGuard-RMS Platform
-- Migration 001: Customer Directory

BEGIN;

CREATE TABLE platform_customers (
    id TEXT PRIMARY KEY,
    customer_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    website_slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT platform_customer_status_check
        CHECK (status IN ('active', 'inactive', 'suspended'))
);

CREATE TABLE platform_customer_domains (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT platform_customer_domains_customer_fk
        FOREIGN KEY (customer_id)
        REFERENCES platform_customers(id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX
    uq_platform_customer_primary_domain
ON platform_customer_domains (customer_id)
WHERE is_primary = TRUE;

COMMIT;
