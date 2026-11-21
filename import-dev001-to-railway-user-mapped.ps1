param(
    [string]$DumpPath = '.\safeguard-dev001-data.dump',
    [switch]$Execute
)
$ErrorActionPreference = 'Stop'
$SourceCustomerId = '4f1cbe8f-cb58-4669-8830-cc917406c13b'
$TargetCustomerId = '16a5fb13-c4d0-4bae-85d8-9b518b455cbb'
if (-not (Test-Path -LiteralPath $DumpPath)) { throw "Missing dump: $DumpPath" }
if (-not $env:RAILWAY_BACKUP_URL) { throw 'RAILWAY_BACKUP_URL is not set.' }
foreach ($tool in @('pg_restore','psql')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is required." }
}
$archive = @(& pg_restore --list $DumpPath)
if ($LASTEXITCODE -ne 0) { throw 'Unable to read archive.' }
$excluded = @('user','account','session','verification','customer_settings')
$allTables = @($archive | ForEach-Object {
    if ($_ -match '^\s*\d+;.* TABLE DATA public ([^ ]+) ') { $Matches[1].Trim('"') }
} | Where-Object { $_ })
$tables = @($allTables | Where-Object { $_ -notin $excluded } | Select-Object -Unique)
if ($tables.Count -lt 10) { throw 'Unexpectedly few operational tables in archive.' }
$targetCheck = @'
SELECT CASE WHEN
 (SELECT count(*) FROM public.customer_settings WHERE customer_code='DEV001' AND id='16a5fb13-c4d0-4bae-85d8-9b518b455cbb' AND status='active')=1
 AND to_regclass('public.users') IS NOT NULL
 AND to_regclass('public.incidents') IS NOT NULL
 THEN 'OK' ELSE 'STOP' END;
'@
$result = $targetCheck | & psql "$env:RAILWAY_BACKUP_URL" -X -q -t -A -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0 -or ($result | Out-String).Trim() -ne 'OK') { throw 'Target database verification failed.' }
$quoted = $tables | ForEach-Object { "'" + $_.Replace("'","''") + "'" }
$tableNames = $quoted -join ','
$metadata = @"
SELECT 'TABLE|' || c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN ($tableNames)
UNION ALL
SELECT 'FK|' || child.relname || '|' || parent.relname
FROM pg_constraint k
JOIN pg_class child ON child.oid=k.conrelid
JOIN pg_namespace ns ON ns.oid=child.relnamespace
JOIN pg_class parent ON parent.oid=k.confrelid
WHERE k.contype='f' AND ns.nspname='public'
 AND child.relname IN ($tableNames) AND parent.relname IN ($tableNames);
"@
$lines = @($metadata | & psql "$env:RAILWAY_BACKUP_URL" -X -q -t -A -v ON_ERROR_STOP=1)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect target table dependencies.' }
$existing = @($lines | Where-Object { $_ -like 'TABLE|*' } | ForEach-Object { $_.Substring(6) })
$missing = @($tables | Where-Object { $_ -notin $existing })
if ($missing.Count) { throw "Target is missing tables: $($missing -join ', ')" }
$deps = @{}; foreach ($t in $tables) { $deps[$t] = @() }
foreach ($line in $lines) {
    if ($line -like 'FK|*') {
        $parts = $line.Split('|'); $deps[$parts[1]] += $parts[2]
    }
}
$pending = [System.Collections.Generic.List[string]]::new()
foreach ($t in $tables) { $pending.Add($t) }
$ordered = [System.Collections.Generic.List[string]]::new()
while ($pending.Count -gt 0) {
    $ready = @($pending | Where-Object { @($deps[$_] | Where-Object { $_ -in $pending }).Count -eq 0 })
    if (-not $ready.Count) { throw 'Foreign-key dependency cycle detected. Manual review required.' }
    foreach ($t in $ready) { $ordered.Add($t); [void]$pending.Remove($t) }
}
Write-Host "Verified DEV001 target. $($tables.Count) operational tables; $($ordered.Count) dependency-ordered inserts."
Write-Host 'Excluded Better Auth user/account/session/verification and customer_settings.'
Write-Host "Customer ID remap: $SourceCustomerId -> $TargetCustomerId"
if (-not $Execute) {
    Write-Host 'DRY RUN: no database changes made. Execute with -Execute after reviewing this output.'
    exit 0
}
$confirmation = Read-Host 'Type IMPORT-DEV001 to execute against Railway production'
if ($confirmation -cne 'IMPORT-DEV001') { throw 'Cancelled.' }
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('dev001-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
    $listFile = Join-Path $tmp 'restore.list'
    $dataFile = Join-Path $tmp 'data.sql'
    $sqlFile = Join-Path $tmp 'import.sql'
    $filtered = @($archive | ForEach-Object {
        if ($_ -match '^\s*\d+;.* TABLE DATA public ([^ ]+) ' -and $Matches[1].Trim('"') -in $excluded) { ';' + $_ } else { $_ }
    })
    [IO.File]::WriteAllLines($listFile, [string[]]$filtered, [Text.UTF8Encoding]::new($false))
    & pg_restore --data-only --use-list="$listFile" --file="$dataFile" --no-owner --no-privileges "$DumpPath"
    if ($LASTEXITCODE -ne 0) { throw 'Failed to extract archive data.' }
    $data = [IO.File]::ReadAllText($dataFile)
    # Fail closed if pg_restore output is not entirely COPY data plus standard session statements.
    if ($data -match '(?m)^\s*(INSERT INTO|CREATE |ALTER |DROP |TRUNCATE |DELETE |UPDATE )') {
        throw 'Unexpected SQL in archive extraction. No import performed.'
    }
    $copyMatches = [regex]::Matches($data, '(?m)^COPY public\.("[^"]+"|[a-zA-Z_][a-zA-Z_0-9]*)\s*\(')
    if ($copyMatches.Count -ne $tables.Count) { throw "COPY statement count mismatch: $($copyMatches.Count) versus $($tables.Count)." }
    $data = [regex]::Replace($data, '(?m)^COPY public\.', 'COPY dev001_import_stage.')
    $sql = [System.Text.StringBuilder]::new()
    [void]$sql.AppendLine('BEGIN;')
    [void]$sql.AppendLine('CREATE SCHEMA dev001_import_stage;')
    foreach ($t in $tables) {
        $q = '"' + $t.Replace('"','""') + '"'
        [void]$sql.AppendLine("CREATE TABLE dev001_import_stage.$q (LIKE public.$q);")
    }
    [void]$sql.AppendLine($data)
    # Remap every customer_id in the staged operational tables, without changing
    # either source or target customer_settings. Reject unexpected customer IDs.
    foreach ($t in $tables) {
        $q = '"' + $t.Replace('"','""') + '"'
        [void]$sql.AppendLine(@"
DO `$$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='dev001_import_stage' AND table_name='$t' AND column_name='customer_id'
  ) THEN
    IF EXISTS (SELECT 1 FROM dev001_import_stage.$q WHERE customer_id IS NOT NULL AND customer_id <> '$SourceCustomerId') THEN
      RAISE EXCEPTION 'Unexpected source customer_id in table $t; aborting import';
    END IF;
    UPDATE dev001_import_stage.$q
       SET customer_id='$TargetCustomerId'
     WHERE customer_id='$SourceCustomerId';
  END IF;
END
`$$;
"@)
    }
    # Map pre-existing production users by unique email, preserving their production IDs.
    # The staging users table contains the local operational users; Better Auth tables
    # are deliberately excluded from the import.
    [void]$sql.AppendLine(@'
CREATE TEMP TABLE dev001_user_id_map AS
SELECT s.id AS source_id, d.id AS target_id
FROM dev001_import_stage.users s
JOIN public.users d ON lower(btrim(s.email)) = lower(btrim(d.email));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM dev001_import_stage.users s
    JOIN public.users d ON lower(btrim(s.email)) = lower(btrim(d.email))
    GROUP BY s.id HAVING count(DISTINCT d.id) <> 1
  ) OR EXISTS (
    SELECT 1 FROM dev001_user_id_map GROUP BY target_id HAVING count(DISTINCT source_id) > 1
  ) THEN
    RAISE EXCEPTION 'Ambiguous user email mapping; import cancelled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM dev001_import_stage.users s
    JOIN public.users d ON d.id = s.id
    WHERE lower(btrim(s.email)) <> lower(btrim(d.email))
  ) THEN
    RAISE EXCEPTION 'User ID collision with different email; import cancelled';
  END IF;
END $$;

-- Update every staged foreign-key column that references public.users(id),
-- including administrative report author_id. Also handle conventional user_id
-- fields that have no FK constraint in older migration versions.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT child.relname AS table_name, att.attname AS column_name
    FROM pg_constraint fk
    JOIN pg_class child ON child.oid = fk.conrelid
    JOIN pg_namespace ns ON ns.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = fk.confrelid
    JOIN pg_namespace pns ON pns.oid = parent.relnamespace
    JOIN LATERAL unnest(fk.conkey) AS col(attnum) ON true
    JOIN pg_attribute att ON att.attrelid = child.oid AND att.attnum = col.attnum
    WHERE fk.contype = 'f' AND ns.nspname = 'public'
      AND pns.nspname = 'public' AND parent.relname = 'users'
      AND array_length(fk.conkey, 1) = 1
    UNION
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'dev001_import_stage'
      AND c.column_name IN ('user_id', 'created_by', 'updated_by', 'archived_by', 'approved_by', 'assigned_to', 'author_id')
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'dev001_import_stage' AND table_name = r.table_name)
       AND EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'dev001_import_stage'
                     AND table_name = r.table_name AND column_name = r.column_name)
       AND r.table_name <> 'users' THEN
      EXECUTE format(
        'UPDATE dev001_import_stage.%I s SET %I = m.target_id FROM dev001_user_id_map m WHERE s.%I = m.source_id AND m.source_id <> m.target_id',
        r.table_name, r.column_name, r.column_name
      );
    END IF;
  END LOOP;
END $$;

-- Do not overwrite the existing production user or its authentication identity.
DELETE FROM dev001_import_stage.users s
USING dev001_user_id_map m
WHERE s.id = m.source_id;
'@)
    # Insert new users first, so their IDs exist for dependent rows.
    if ($ordered -contains 'users') {
        [void]$sql.AppendLine('INSERT INTO public.users SELECT * FROM dev001_import_stage.users ON CONFLICT DO NOTHING;')
    }
    foreach ($t in $ordered) {
        if ($t -eq 'users') { continue }
        $q = '"' + $t.Replace('"','""') + '"'
        # Use only columns present in both source staging and destination; fail on mismatches rather than silently losing data.
        [void]$sql.AppendLine("INSERT INTO public.$q SELECT * FROM dev001_import_stage.$q ON CONFLICT DO NOTHING;")
    }
    [void]$sql.AppendLine('DROP SCHEMA dev001_import_stage CASCADE;')
    [void]$sql.AppendLine('COMMIT;')
    [IO.File]::WriteAllText($sqlFile, $sql.ToString(), [Text.UTF8Encoding]::new($false))
    & psql "$env:RAILWAY_BACKUP_URL" -X -v ON_ERROR_STOP=1 -f "$sqlFile"
    if ($LASTEXITCODE -ne 0) { throw 'Import failed. PostgreSQL transaction should have rolled back; inspect errors.' }
    Write-Host 'Import committed. Verify records on the website.'
} finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
