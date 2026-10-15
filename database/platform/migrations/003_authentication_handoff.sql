
-- SafeGuard-RMS Platform
-- Migration 003: Authentication Handoff Codes

BEGIN;

CREATE TABLE platform_auth_handoffs (
    id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT platform_handoff_user_fk
        FOREIGN KEY (user_id)
        REFERENCES "user"(id)
        ON DELETE CASCADE,

    CONSTRAINT platform_handoff_customer_fk
        FOREIGN KEY (customer_id)
        REFERENCES platform_customers(id),

    CONSTRAINT platform_handoff_expiration_check
        CHECK (expires_at > created_at)
);

CREATE INDEX idx_platform_handoffs_user
ON platform_auth_handoffs (user_id);

CREATE INDEX idx_platform_handoffs_customer
ON platform_auth_handoffs (customer_id);

CREATE INDEX idx_platform_handoffs_expiration
ON platform_auth_handoffs (expires_at);

COMMIT;

