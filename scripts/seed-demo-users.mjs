/** SafeGuard-RMS demo seeder. Run from repository root, Node 20+.
 * Required environment variables: DEV001_DATABASE_URL, DEV002_DATABASE_URL,
 * PLATFORM_DATABASE_URL, DEMO_SEED_CONFIRM=DEV001,DEV002,PLATFORM.
 * Default dry-run. Use --execute to write. Never use against production.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { writeFileSync, openSync, closeSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { Pool } from 'pg'
import { betterAuth } from 'better-auth'

const execute = process.argv.includes('--execute')
const expectedConfirm = 'DEV001,DEV002,PLATFORM'
const plans = [
  { code: 'DEV001', env: 'DEV001_DATABASE_URL', roles: { user: 10, supervisor: 5, investigator: 2, office_staff: 3 } },
  { code: 'DEV002', env: 'DEV002_DATABASE_URL', roles: { user: 10, supervisor: 5, investigator: 3, office_staff: 2 } },
]
const globalRoles = { support: 5, backend: 5 }
const emailDomain = 'example.invalid' // Reserved, non-deliverable; no real emails are sent.
const now = () => new Date().toISOString()
const clean = s => s.replace(/[^a-z0-9]/gi, '')
const password = () => randomBytes(24).toString('base64url') + 'Aa1!'

function accountsFor(code, roles) {
  return Object.entries(roles).flatMap(([role, count]) =>
    Array.from({ length: count }, (_, i) => {
      const label = String(i + 1).padStart(2, '0')
      return { code, role, name: `Demo ${role.replaceAll('_', ' ')} ${label} (${code})`,
        email: `demo.${code.toLowerCase()}.${clean(role)}${label}@${emailDomain}` }
    }))
}
const targets = [...plans.map(p => ({ ...p, accounts: accountsFor(p.code, p.roles) })),
  { code: 'PLATFORM', env: 'PLATFORM_DATABASE_URL', accounts: accountsFor('PLATFORM', globalRoles) }]

async function inspect(pool, target) {
  const db = await pool.query('select current_database() as name, inet_server_addr()::text as host')
  const name = db.rows[0].name
  const settings = target.code === 'PLATFORM'
    ? await pool.query("select to_regclass('public.platform_user_roles') as roles, to_regclass('public.\"user\"') as auth")
    : await pool.query("select customer_code from customer_settings")
  if (target.code === 'PLATFORM') {
    if (!settings.rows[0].roles || !settings.rows[0].auth) throw Error('Platform schema missing')
  } else if (settings.rows.length !== 1 || settings.rows[0].customer_code !== target.code) {
    throw Error(`${target.code} database customer_settings mismatch`)
  }
  if (/prod|production|live/i.test(name)) throw Error(`Refusing database named ${name}`)
  console.log(`${target.code}: verified database ${name}; ${target.accounts.length} planned accounts`)
}

async function seed(target, pool, credentials) {
  // Better Auth generates valid password hashes and identity/account rows.
  const auth = betterAuth({
    database: pool,
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    secret: process.env.DEMO_AUTH_SECRET || randomBytes(32).toString('hex'),
    baseURL: 'http://localhost:3000',
    advanced: { cookiePrefix: `demo_${target.code.toLowerCase()}` },
  })
  for (const account of target.accounts) {
    const found = await pool.query('SELECT id FROM "user" WHERE lower(email) = $1', [account.email])
    if (found.rowCount) {
      console.log(`SKIP existing ${account.email}`)
      continue
    }
    const pass = password()
    // Uses Better Auth's supported signup API rather than constructing password hashes.
    const created = await auth.api.signUpEmail({ body: { name: account.name, email: account.email, password: pass } })
    const id = created?.user?.id
    if (!id) throw Error(`Better Auth did not return a user ID for ${account.email}`)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      if (target.code === 'PLATFORM') {
        await client.query(`INSERT INTO platform_user_roles (id,user_id,platform_role,created_at)
          VALUES ($1,$2,$3,NOW()) ON CONFLICT DO NOTHING`, [randomUUID(), id, account.role])
      } else {
        const stamp = now()
        await client.query(`INSERT INTO users (id,email,email_verified,display_name,created_at,updated_at,last_sign_in,is_archived)
          VALUES ($1,$2,1,$3,$4,$4,$4,0) ON CONFLICT (id) DO NOTHING`, [id, account.email, account.name, stamp])
        await client.query(`INSERT INTO app_roles (id,user_id,role,created_at,updated_at)
          VALUES ($1,$2,$3,$4,$4) ON CONFLICT (user_id) DO NOTHING`, [randomUUID(), id, account.role, stamp])
        const c = await client.query('SELECT id FROM customer_settings WHERE customer_code=$1', [target.code])
        await client.query(`INSERT INTO user_customer_assignments (id,user_id,customer_id,created_at)
          VALUES ($1,$2,$3,NOW()) ON CONFLICT (user_id,customer_id) DO NOTHING`, [randomUUID(), id, c.rows[0].id])
      }
      await client.query('COMMIT')
      credentials.push([target.code, account.role, account.email, pass].join(','))
      console.log(`CREATED ${account.email}`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally { client.release() }
  }
}

const pools = []
try {
  if (execute && process.env.DEMO_SEED_CONFIRM !== expectedConfirm) throw Error(`Set DEMO_SEED_CONFIRM=${expectedConfirm}`)
  if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT || process.env.CI) throw Error('Refusing production/CI/Railway execution')
  for (const target of targets) {
    const url = process.env[target.env]
    if (!url) throw Error(`Missing ${target.env}`)
    const parsed = new URL(url)
    if (!['localhost','127.0.0.1','::1','[::1]'].includes(parsed.hostname)) throw Error(`Refusing non-local DB for ${target.code}: ${parsed.hostname}`)
    const pool = new Pool({ connectionString: url })
    pools.push(pool)
    await inspect(pool, target)
  }
  if (!execute) {
    for (const t of targets) t.accounts.forEach(a => console.log(`PLAN ${a.code} ${a.role} ${a.email}`))
    console.log('DRY RUN ONLY. Use --execute and DEMO_SEED_CONFIRM to create accounts.')
  } else {
    const dir = resolve('.demo-credentials')
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const outfile = resolve(dir, `demo-credentials-${Date.now()}.csv`)
    // Open before writing to ensure local private permissions, avoid stdout passwords.
    const fd = openSync(outfile, 'wx', 0o600)
    closeSync(fd)
    const creds = ['customer,role,email,temporary_password']
    try {
      for (let i = 0; i < targets.length; i++) {
        await seed(targets[i], pools[i], creds)
        writeFileSync(outfile, creds.join('\n') + '\n', { mode: 0o600 })
      }
    } finally { writeFileSync(outfile, creds.join('\n') + '\n', { mode: 0o600 }) }
    console.log(`Credentials saved locally: ${outfile}. Do not commit or share. Delete after demo.`)
  }
} catch (error) {
  console.error('SEED FAILED:', error.message)
  process.exitCode = 1
} finally { await Promise.all(pools.map(p => p.end())) }
