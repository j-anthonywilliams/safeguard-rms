import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { Pool } from 'pg'
import { getRequestHeaders } from '@tanstack/start-server-core'

let pool: Pool | undefined
let authInstance: ReturnType<typeof createAuth> | undefined

function getPool() {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured')
    }

    pool = new Pool({
      connectionString: databaseUrl,
    })
  }

  return pool
}

function createAuth() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    database: getPool(),

    emailAndPassword: {
      enabled: true,
    },

    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
              disableImplicitSignUp: process.env.NODE_ENV !== 'development',
            },
          }
        : {},

    plugins: [tanstackStartCookies()],
  })
}

export function getAuth() {
  return (authInstance ??= createAuth())
}
export const auth = getAuth()

export async function getSession() {
  return getAuth().api.getSession({
    headers: getRequestHeaders(),
  })
}