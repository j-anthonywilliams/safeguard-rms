
import { betterAuth } from 'better-auth'
import { jwt } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { oauthProvider } from '@better-auth/oauth-provider'
import { getRequestHeaders } from '@tanstack/start-server-core'

import { getPlatformDb } from './platform-db.server'

let platformAuthInstance:
  | ReturnType<typeof createPlatformAuth>
  | undefined

async function isBackendPlatformUser(
  userId: string | undefined,
): Promise<boolean> {
  if (!userId) {
    return false
  }

  const db = getPlatformDb()

  const result = await db.query<{ authorized: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM platform_user_roles
        WHERE user_id = $1
          AND platform_role = 'backend'
      ) AS authorized
    `,
    [userId],
  )

  return result.rows[0]?.authorized === true
}

function createPlatformAuth() {
  const baseURL = process.env.PLATFORM_AUTH_URL
  const secret = process.env.PLATFORM_AUTH_SECRET

  if (!baseURL) {
    throw new Error(
      'PLATFORM_AUTH_URL is not configured',
    )
  }

  if (!secret) {
    throw new Error(
      'PLATFORM_AUTH_SECRET is not configured',
    )
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

    plugins: [
      jwt(),

      oauthProvider({
        loginPage: '/platform-login',
        consentPage: '/platform-consent',

        scopes: [
          'openid',
          'profile',
          'email',
        ],

        allowDynamicClientRegistration: false,
        clientRegistrationRequirePKCE: true,

        clientPrivileges: async ({ user, session }) => {
          if (!user?.id || !session?.userId) {
            return false
          }

          if (user.id !== session.userId) {
            return false
          }

          return isBackendPlatformUser(user.id)
        },
      }),

      tanstackStartCookies(),
    ],
  })
}

export function getPlatformAuth() {
  return (
    platformAuthInstance ??=
      createPlatformAuth()
  )
}

// Required by the Better Auth CLI for schema generation.
export const auth = getPlatformAuth()

export async function getPlatformSession() {
  return getPlatformAuth().api.getSession({
    headers: getRequestHeaders(),
  })
}

export async function requirePlatformSession() {
  const session = await getPlatformSession()

  if (!session?.user?.id) {
    throw new Error(
      'Platform authentication required',
    )
  }

  return session
}
