-- Allow the Office Staff role without removing existing role constraints indiscriminately.
DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.app_roles'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%role%'
      AND pg_get_constraintdef(oid) LIKE '%supervisor%'
  LOOP
    EXECUTE format('ALTER TABLE public.app_roles DROP CONSTRAINT %I', constraint_name);
  END LOOP;
  ALTER TABLE public.app_roles ADD CONSTRAINT app_roles_role_check
    CHECK (role IN ('user','office_staff','supervisor','admin','support','backend'));
END $$;
