
-- SafeGuard-RMS Platform
-- Migration 005: Customer Service Credentials

BEGIN;

CREATE TABLE platform_customer_service_credentials (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    credential_hash TEXT NOT NULL UNIQUE,
    credential_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,

    CONSTRAINT platform_service_credential_customer_fk
        FOREIGN KEY (customer_id)
        REFERENCES platform_customers(id),

    CONSTRAINT platform_service_credential_status_check
        CHECK (status IN ('active', 'revoked'))
);

CREATE INDEX idx_platform_service_credentials_customer
ON platform_customer_service_credentials (customer_id);

CREATE INDEX idx_platform_service_credentials_status
ON platform_customer_service_credentials (status);

COMMIT;
