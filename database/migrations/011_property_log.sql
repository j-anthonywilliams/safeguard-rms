CREATE TABLE IF NOT EXISTS property_log (
  id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customer_settings(id),
  user_id text NOT NULL REFERENCES users(id),
  item_number text NOT NULL,
  description text NOT NULL,
  location text NOT NULL,
  status text NOT NULL DEFAULT 'In custody',
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_property_log_customer ON property_log(customer_id);
