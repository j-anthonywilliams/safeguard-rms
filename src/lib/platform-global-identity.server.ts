import { getPlatformDb } from './platform-db.server'
import { requirePlatformSession } from './platform-auth.server'

export type GlobalPlatformRole = 'support' | 'backend'

export interface GlobalPlatformIdentity {
  platformUserId: string
  email: string
  role: GlobalPlatformRole
}

/** Resolve authority only from the platform identity store. Never from
 * customer-local app_roles, customer assignments, or an email claim. */
export async function resolveGlobalPlatformIdentity(
  platformUserId: string,
): Promise<GlobalPlatformIdentity | null> {
  if (!platformUserId) return null

  const result = await getPlatformDb().query<{
    id: string
    email: string
    platform_role: GlobalPlatformRole
  }>(
    `
      SELECT u.id, u.email, pr.platform_role
      FROM "user" u
      JOIN platform_user_roles pr ON pr.user_id = u.id
      WHERE u.id = $1
        AND pr.platform_role IN ('support', 'backend')
      ORDER BY CASE WHEN pr.platform_role = 'support' THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [platformUserId],
  )

  const identity = result.rows[0]
  return identity
    ? { platformUserId: identity.id, email: identity.email, role: identity.platform_role }
    : null
}

/** Only a verified platform session can establish the acting principal. */
export async function requireGlobalPlatformIdentity(): Promise<GlobalPlatformIdentity> {
  const session = await requirePlatformSession()
  const identity = await resolveGlobalPlatformIdentity(session.user.id)
  if (!identity) throw new Error('Global platform authorization required')
  return identity
}
