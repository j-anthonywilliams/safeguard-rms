
import { Pool } from 'pg'

let platformPool: Pool | undefined

export function getPlatformDb(): Pool {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Platform PostgreSQL may only be accessed from the server',
    )
  }

  const connectionString = process.env.PLATFORM_DATABASE_URL

  if (!connectionString) {
    throw new Error(
      'PLATFORM_DATABASE_URL is not configured',
    )
  }

  if (!platformPool) {
    platformPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  }

  return platformPool
}
