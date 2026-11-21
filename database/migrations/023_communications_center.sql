-- Customer-scoped manual communications. Automatic workflow notifications are separate.
BEGIN;
CREATE TABLE IF NOT EXISTS communication_messages (
 id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customer_settings(id),
 sender_id TEXT NOT NULL REFERENCES users(id), recipient_id TEXT REFERENCES users(id),
 kind TEXT NOT NULL CHECK (kind IN ('direct','announcement')),
 subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
 body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK ((kind='direct' AND recipient_id IS NOT NULL) OR (kind='announcement' AND recipient_id IS NULL))
);
CREATE TABLE IF NOT EXISTS communication_recipients (
 message_id TEXT NOT NULL REFERENCES communication_messages(id) ON DELETE CASCADE,
 customer_id TEXT NOT NULL REFERENCES customer_settings(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 read_at TIMESTAMPTZ,
 PRIMARY KEY(message_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_communication_inbox ON communication_recipients(customer_id,user_id,read_at);
CREATE INDEX IF NOT EXISTS idx_communication_messages_created ON communication_messages(customer_id,created_at DESC);
COMMIT;
