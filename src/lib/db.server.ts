import { Pool } from 'pg'

let pool: Pool | undefined

export function getDb() {
  if (typeof window !== 'undefined') {
    throw new Error('PostgreSQL may only be accessed from the server')
  }

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured')
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  }

  return pool
}