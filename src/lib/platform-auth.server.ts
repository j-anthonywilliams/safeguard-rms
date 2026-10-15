
import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { getRequestHeaders } from '@tanstack/start-server-core'
import { getPlatformDb } from './platform-db.server'

let platformAuthInstance:
  | ReturnType<typeof createPlatformAuth>
  | undefined

function createPlatformAuth() {
  const baseURL = process.env.PLATFORM_AUTH_URL
  const secret = process.env.PLATFORM_AUTH_SECRET

  if (!baseURL) {
    throw new Error('PLATFORM_AUTH_URL is not configured')
  }

  if (!secret) {
    throw new Error('PLATFORM_AUTH_SECRET is not configured')
  }

  return betterAuth({
    baseURL,
    basePath: '/api/platform-auth',

    secret,

    advanced: {
      cookiePrefix: 'safeguard_platform',
    },

    database: getPlatformDb(),

    emailAndPassword: {
      enabled: true,
    },

    plugins: [tanstackStartCookies()],
  })
}

export function getPlatformAuth() {
  return (
    platformAuthInstance ??=
      createPlatformAuth()
  )
}

export async function getPlatformSession() {
  return getPlatformAuth().api.getSession({
    headers: getRequestHeaders(),
  })
}

export async function requirePlatformSession() {
  const session = await getPlatformSession()

  if (!session?.user?.id) {
    throw new Error('Platform authentication required')
  }

  return session
}
