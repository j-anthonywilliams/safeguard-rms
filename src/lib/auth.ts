
import { betterAuth } from 'better-auth'
import { genericOAuth } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { Pool } from 'pg'
import { getRequestHeaders } from '@tanstack/start-server-core'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { getCustomerAuthPolicy } from './customer-auth-policy.server'

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

      hooks: {
        before: createAuthMiddleware(async ctx => {
          const path = ctx.path
            
          const emailPasswordPaths = [
            '/sign-in/email',
            '/sign-up/email',
          ]

          const socialSignInPath = '/sign-in/social'

          const oauthCallbackPath = '/callback/:id'

          const requiresPolicy =
            emailPasswordPaths.includes(path) ||
            path === socialSignInPath ||
            path === oauthCallbackPath

          if (!requiresPolicy) {
            return
          }

          // Fail closed if the customer policy cannot be retrieved.
          let policy

          try {
            policy = await getCustomerAuthPolicy()
          } catch {
            throw new APIError('FORBIDDEN', {
              message: 'Customer authentication policy unavailable',
            })
          }

          if (
            emailPasswordPaths.includes(path) &&
            !policy.emailPasswordEnabled
          ) {
            throw new APIError('FORBIDDEN', {
              message: 'Email/password authentication is disabled',
            })
          }

          if (path === socialSignInPath) {
            const body = ctx.body as {
              provider?: string
            } | undefined

            const provider = body?.provider

            if (
              provider === 'google' &&
              !policy.googleEnabled
            ) {
              throw new APIError('FORBIDDEN', {
                message: 'Google authentication is disabled',
              })
            }

            if (
              provider === 'safeguard-platform' &&
              !policy.platformSsoEnabled
            ) {
              throw new APIError('FORBIDDEN', {
                message: 'SafeGuard-RMS SSO is disabled',
              })
            }

            // Deny unknown providers rather than accidentally
            // allowing an unconfigured authentication method.
            if (
              provider !== 'google' &&
              provider !== 'safeguard-platform'
            ) {
              throw new APIError('FORBIDDEN', {
                message: 'Authentication provider is not enabled',
              })
            }
          }

          if (path === oauthCallbackPath) {
            const callbackUrl = new URL(ctx.request!.url)

            const pathSegments = callbackUrl.pathname
              .split('/')
              .filter(Boolean)

            const provider = pathSegments[pathSegments.length - 1]

            if (provider === 'google' && !policy.googleEnabled) {
              throw new APIError('FORBIDDEN', {
                message: 'Google authentication is disabled',
              })
            }

            if (
              provider === 'safeguard-platform' &&
              !policy.platformSsoEnabled
            ) {
              throw new APIError('FORBIDDEN', {
                message: 'SafeGuard-RMS SSO is disabled',
              })
            }

            if (
              provider !== 'google' &&
              provider !== 'safeguard-platform'
            ) {
              throw new APIError('FORBIDDEN', {
                message: 'Authentication provider is not enabled',
              })
            }
          }
         
        }),
      },

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
