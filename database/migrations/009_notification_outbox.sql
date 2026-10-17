
-- SafeGuard-RMS
-- Migration 009: Notification Outbox

BEGIN;

CREATE TABLE notification_outbox (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    recipient_user_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    last_error TEXT,

    CONSTRAINT notification_customer_fk
        FOREIGN KEY (customer_id)
        REFERENCES customer_settings(id),

    CONSTRAINT notification_status_check
        CHECK (
            status IN (
                'pending',
                'processing',
                'sent',
                'failed'
            )
        ),

    CONSTRAINT notification_attempts_check
        CHECK (attempts >= 0)
);

CREATE INDEX idx_notification_outbox_pending
ON notification_outbox (
    next_attempt_at,
    created_at
)
WHERE status IN ('pending', 'failed');

CREATE INDEX idx_notification_outbox_recipient
ON notification_outbox (recipient_user_id);

CREATE INDEX idx_notification_outbox_reference
ON notification_outbox (
    notification_type,
    reference_id
);

COMMIT;
