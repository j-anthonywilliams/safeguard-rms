
import { betterAuth } from 'better-auth'
import { genericOAuth } from 'better-auth/plugins'
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

  const oidcEnabled =
    process.env.CUSTOMER_OIDC_ENABLED === 'true'

  const oidcClientId =
    process.env.SAFEGUARD_PLATFORM_OIDC_CLIENT_ID

  const oidcClientSecret =
    process.env.SAFEGUARD_PLATFORM_OIDC_CLIENT_SECRET

  const oidcDiscoveryUrl =
    process.env.SAFEGUARD_PLATFORM_OIDC_DISCOVERY_URL

  if (
    oidcEnabled &&
    (!oidcClientId || !oidcClientSecret || !oidcDiscoveryUrl)
  ) {
    throw new Error(
      'Customer OIDC configuration is incomplete',
    )
    }

    return betterAuth({
      baseURL: process.env.BETTER_AUTH_URL,

    trustedOrigins: [
      'http://localhost:3000',
      'http://localhost:3001',
    ],

    database: getPool(),

    emailAndPassword: {
      enabled: true,
    },

    account: {
      accountLinking: {
        enabled: true,

        // Never attach an OAuth identity merely because
        // its email matches an existing customer account.
        disableImplicitLinking: true,

        // Explicit linkSocial() linking is permitted only
        // for the SafeGuard-RMS platform provider.
        trustedProviders: ['safeguard-platform'],

        // The platform and customer account emails must match.
        allowDifferentEmails: false,

        // Do not overwrite the customer profile during linking.
        updateUserInfoOnLink: false,
      },
    },

    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
              disableImplicitSignUp:
                process.env.NODE_ENV !== 'development',
            },
          }
        : {},

    plugins: [
      ...(oidcEnabled &&
      oidcClientId &&
      oidcClientSecret &&
      oidcDiscoveryUrl
        ? [
            genericOAuth({
              config: [
                {
                  providerId: 'safeguard-platform',
                  clientId: oidcClientId,
                  clientSecret: oidcClientSecret,
                  discoveryUrl: oidcDiscoveryUrl,
                  tokenEndpointAuth: {
                    method: 'client_secret_basic',
                  },
                  scopes: [
                    'openid',
                    'profile',
                    'email',
                  ],
                  pkce: true,
                  // OIDC may authenticate or link existing customer users, but it may never create a new customer account.
                  disableSignUp: true,
                },
              ],
            }),
          ]
        : []),

      tanstackStartCookies(),
    ],
  })
}

export function getAuth() {
  return (authInstance ??= createAuth())
}

if (process.env.NODE_ENV === 'development') {
  const configuredAuth = getAuth()

  console.log(
    'Customer OAuth providers:',
    Object.keys(
      configuredAuth.options.socialProviders ?? {},
    ),
  )

  console.log(
    'Customer OIDC enabled:',
    process.env.CUSTOMER_OIDC_ENABLED,
  )

  console.log(
    'Generic OAuth plugin installed:',
    configuredAuth.options.plugins?.some(
      plugin => plugin.id === 'generic-oauth',
    ),
  )
}

export const auth = getAuth()

export async function getSession() {
  return getAuth().api.getSession({
    headers: getRequestHeaders(),
  })
}
