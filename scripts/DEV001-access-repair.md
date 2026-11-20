# DEV001 record-access repair

Google authentication is already working. `requireActiveUser()` deliberately rejects customer-local `backend` roles unless a verified platform identity mapping exists. This repair assigns one already-authenticated DEV001 account the customer-scoped `admin` role, which allows customer record access without granting global platform authority.

**Before running:** confirm the intended account is `joel.williams294@gmail.com`, that the database backup is retained, and that `RAILWAY_BACKUP_URL` points to the original customer Postgres service (not Postgres-Platform).

Run from VS Code PowerShell:

```powershell
psql "$env:RAILWAY_BACKUP_URL" -X -v ON_ERROR_STOP=1 -1 -f ".\scripts\restore-customer-admin-access.sql"
```

The script aborts without changing roles unless the customer ID, email, user ID, Better Auth identity and existing legacy backend role all match. Then sign out and back in, and verify Incident Reports and Users. Global Backend access must be provisioned separately through a verified platform identity.
