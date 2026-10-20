
-- SafeGuard-RMS
-- Migration 007: Customer Authentication Settings

CREATE TABLE IF NOT EXISTS platform_customer_auth_settings (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL UNIQUE
        REFERENCES platform_customers(id)
        ON DELETE RESTRICT,

    google_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_password_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    platform_sso_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    institutional_sso_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT customer_auth_method_required
        CHECK (
            google_enabled
            OR email_password_enabled
            OR platform_sso_enabled
            OR institutional_sso_enabled
        )
);

-- Initialize settings for existing customers.
INSERT INTO platform_customer_auth_settings (
    id,
    customer_id,
    google_enabled,
    email_password_enabled,
    platform_sso_enabled,
    institutional_sso_enabled
)
SELECT
    gen_random_uuid()::TEXT,
    c.id,
    TRUE,
    TRUE,
    FALSE,
    FALSE
FROM platform_customers c
WHERE NOT EXISTS (
    SELECT 1
    FROM platform_customer_auth_settings s
    WHERE s.customer_id = c.id
);

-- Automatically initialize authentication settings
-- for newly created customers.
CREATE OR REPLACE FUNCTION initialize_customer_auth_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO platform_customer_auth_settings (
        id,
        customer_id
    )
    VALUES (
        gen_random_uuid()::TEXT,
        NEW.id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS
    trg_initialize_customer_auth_settings
ON platform_customers;

CREATE TRIGGER trg_initialize_customer_auth_settings
AFTER INSERT ON platform_customers
FOR EACH ROW
EXECUTE FUNCTION initialize_customer_auth_settings();
