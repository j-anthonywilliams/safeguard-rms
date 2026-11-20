-- One-time DEV001 customer-scoped access repair.
-- Run only against the DEV001 CUSTOMER database, never Postgres-Platform.
-- Does not grant platform backend privileges.
BEGIN;
DO $$
DECLARE
  expected_customer CONSTANT text := '16a5fb13-c4d0-4bae-85d8-9b518b455cbb';
  expected_user CONSTANT text := 'CP5cpnkGySexBkNGCRe52DPh06C2';
  expected_email CONSTANT text := 'joel.williams294@gmail.com';
BEGIN
  IF (SELECT count(*) FROM customer_settings WHERE id = expected_customer AND customer_code = 'DEV001' AND status = 'active') <> 1 THEN
    RAISE EXCEPTION 'Expected active DEV001 customer not found; no changes made';
  END IF;
  IF (SELECT count(*) FROM users WHERE id = expected_user AND lower(email) = expected_email AND coalesce(is_archived, 0) = 0) <> 1 THEN
    RAISE EXCEPTION 'Expected active customer user not found; no changes made';
  END IF;
  IF (SELECT count(*) FROM "user" WHERE id = expected_user AND lower(email) = expected_email) <> 1 THEN
    RAISE EXCEPTION 'Matching authenticated user not found; no changes made';
  END IF;
  IF (SELECT count(*) FROM app_roles WHERE user_id = expected_user AND role = 'backend') <> 1 THEN
    RAISE EXCEPTION 'Expected legacy backend role not found; no changes made';
  END IF;
  UPDATE app_roles SET role = 'admin', updated_at = now()::text WHERE user_id = expected_user AND role = 'backend';
END $$;
COMMIT;
SELECT u.email, r.role FROM users u JOIN app_roles r ON r.user_id=u.id WHERE u.id='CP5cpnkGySexBkNGCRe52DPh06C2';
