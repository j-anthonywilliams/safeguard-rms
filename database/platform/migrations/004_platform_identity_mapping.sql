
-- SafeGuard-RMS Platform
-- Migration 004: Trusted Platform-to-Customer Identity Mapping

BEGIN;

CREATE TABLE platform_customer_user_mappings (
    id TEXT PRIMARY KEY,

    platform_user_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    customer_user_id TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'active',

    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_by TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT platform_user_mapping_user_fk
        FOREIGN KEY (platform_user_id)
        REFERENCES "user"(id),

    CONSTRAINT platform_user_mapping_customer_fk
        FOREIGN KEY (customer_id)
        REFERENCES platform_customers(id),

    CONSTRAINT platform_user_mapping_status_check
        CHECK (status IN ('active', 'inactive', 'revoked')),

    CONSTRAINT platform_user_mapping_unique
        UNIQUE (platform_user_id, customer_id),

    CONSTRAINT platform_customer_user_unique
        UNIQUE (customer_id, customer_user_id)
);

CREATE INDEX idx_platform_user_mappings_customer
ON platform_customer_user_mappings (customer_id);

CREATE INDEX idx_platform_user_mappings_platform_user
ON platform_customer_user_mappings (platform_user_id);

COMMIT;
