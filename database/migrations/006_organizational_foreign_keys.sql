
-- SafeGuard-RMS
-- Migration 006: Organizational Foreign Keys
-- Preserves all existing operational records.

BEGIN;

-- A site must belong to the specified client.
-- A client must belong to the specified customer.
-- NULL client and site references remain permitted.

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'incidents',
        'case_files',
        'evidence',
        'equipment',
        'attendance_logs',
        'schedule_entries',
        'pto_requests'
    ]
    LOOP

        -- Customer relationship
        EXECUTE format(
            'ALTER TABLE %I
             ADD CONSTRAINT %I
             FOREIGN KEY (customer_id)
             REFERENCES customer_settings(id)',
            table_name,
            table_name || '_customer_fk'
        );

        -- Client relationship
        EXECUTE format(
            'ALTER TABLE %I
             ADD CONSTRAINT %I
             FOREIGN KEY (customer_id, client_id)
             REFERENCES clients(customer_id, id)',
            table_name,
            table_name || '_client_fk'
        );

        -- Site relationship
        EXECUTE format(
            'ALTER TABLE %I
             ADD CONSTRAINT %I
             FOREIGN KEY (customer_id, client_id, site_id)
             REFERENCES sites(customer_id, client_id, id)',
            table_name,
            table_name || '_site_fk'
        );

    END LOOP;
END $$;

-- Prevent partially specified organizational references.
-- A client requires a customer.
-- A site requires both a customer and a client.

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'incidents',
        'case_files',
        'evidence',
        'equipment',
        'attendance_logs',
        'schedule_entries',
        'pto_requests'
    ]
    LOOP
        EXECUTE format(
            'ALTER TABLE %I
             ADD CONSTRAINT %I
             CHECK (
               (client_id IS NULL OR customer_id IS NOT NULL)
               AND
               (site_id IS NULL OR (
                 customer_id IS NOT NULL
                 AND client_id IS NOT NULL
               ))
             )',
            table_name,
            table_name || '_organization_check'
        );
    END LOOP;
END $$;

COMMIT;
