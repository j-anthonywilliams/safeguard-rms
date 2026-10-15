
-- SafeGuard-RMS
-- Migration 008: Customer-wide report numbering
-- Preserve existing report numbers.

BEGIN;

-- Enforce unique report numbers within each customer.
CREATE UNIQUE INDEX IF NOT EXISTS
    uq_incidents_customer_report_number
ON incidents (customer_id, report_number);

-- Initialize annual sequences using existing
-- original reports in YYIIII format.
INSERT INTO customer_report_sequences (
    customer_id,
    report_year,
    last_sequence
)
SELECT
    customer_id,
    2000 + LEFT(report_number, 2)::INTEGER,
    MAX(RIGHT(report_number, 4)::INTEGER)
FROM incidents
WHERE customer_id IS NOT NULL
  AND parent_incident_id IS NULL
  AND report_number ~ '^[0-9]{6}$'
  AND RIGHT(report_number, 4)::INTEGER BETWEEN 1 AND 9999
GROUP BY
    customer_id,
    2000 + LEFT(report_number, 2)::INTEGER
ON CONFLICT (customer_id, report_year)
DO UPDATE SET
    last_sequence = GREATEST(
        customer_report_sequences.last_sequence,
        EXCLUDED.last_sequence
    ),
    updated_at = NOW();

COMMIT;
