
-- SafeGuard-RMS Platform
-- Migration 002: Customer Memberships and Platform Roles

BEGIN;

CREATE TABLE platform_customer_memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    customer_role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT platform_membership_user_fk
        FOREIGN KEY (user_id)
        REFERENCES "user"(id),

    CONSTRAINT platform_membership_customer_fk
        FOREIGN KEY (customer_id)
        REFERENCES platform_customers(id),

    CONSTRAINT platform_membership_unique
        UNIQUE (user_id, customer_id),

    CONSTRAINT platform_membership_status_check
        CHECK (
            status IN ('active', 'inactive', 'suspended')
        ),

    CONSTRAINT platform_membership_role_check
        CHECK (
            customer_role IN (
                'user',
                'investigator',
                'supervisor',
                'office_staff',
                'admin'
            )
        )
);

CREATE TABLE platform_user_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform_role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT platform_user_roles_user_fk
        FOREIGN KEY (user_id)
        REFERENCES "user"(id),

    CONSTRAINT platform_user_roles_unique
        UNIQUE (user_id, platform_role),

    CONSTRAINT platform_user_roles_role_check
        CHECK (
            platform_role IN (
                'support',
                'backend'
            )
        )
);

CREATE INDEX idx_platform_memberships_customer
ON platform_customer_memberships (customer_id);

CREATE INDEX idx_platform_memberships_user
ON platform_customer_memberships (user_id);

CREATE INDEX idx_platform_user_roles_user
ON platform_user_roles (user_id);

COMMIT;
