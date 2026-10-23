-- DEV001 and other customer databases: introduce Investigator as a customer role.
-- Existing Support/Backend rows are retained for compatibility; do not assign new ones.
BEGIN;
DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.app_roles'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.app_roles DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;
ALTER TABLE public.app_roles ADD CONSTRAINT app_roles_role_check
  CHECK (role IN ('user','investigator','office_staff','supervisor','admin','support','backend'));
COMMIT;
