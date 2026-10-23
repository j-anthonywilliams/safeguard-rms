
import { getSession } from './auth'
import { getDb } from './db.server'
import type { AccessLevel } from './access-control'
import { getPlatformDb } from './platform-db.server'
import { getCustomerContext } from './customer-context.server'

export interface AuthorizedUser {
  id: string
  email: string
  role: AccessLevel
}

export async function requireActiveUser(): Promise<AuthorizedUser> {
  const session = await getSession()

  if (!session?.user?.id) {
    throw new Error('Authentication required')
  }

  const db = getDb()

  const result = await db.query<{
    id: string
    email: string
    role: AccessLevel | null
    is_archived: number
  }>(
    `
      SELECT
        u.id,
        u.email,
        r.role,
        u.is_archived
      FROM users u
      LEFT JOIN app_roles r ON r.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `,
    [session.user.id]
  )

  const user = result.rows[0]

  if (!user) {
    throw new Error('Application account not found')
  }

  if (user.is_archived === 1) {
    throw new Error('Account archived. Access denied.')
  }

  // Resolve global roles from the authoritative platform database, using
  // a verified platform-to-customer identity mapping, not a customer app_role.
  const customer = await getCustomerContext()
  const platform = getPlatformDb()
  const globalRoleResult = await platform.query<{ platform_role: 'backend' | 'support' }>(
    `
      SELECT pr.platform_role
      FROM platform_customer_user_mappings m
      JOIN platform_user_roles pr ON pr.user_id = m.platform_user_id
      JOIN platform_customers pc ON pc.id = m.customer_id
      WHERE m.customer_user_id = $1
        AND m.customer_id = $2
        AND m.status = 'active'
        AND pc.status = 'active'
      ORDER BY CASE WHEN pr.platform_role = 'support' THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [user.id, customer.id],
  )

  const globalRole = globalRoleResult.rows[0]?.platform_role
  if (globalRole === 'support' || user.role === 'support') {
    throw new Error('Support cannot access operational customer environments')
  }

  // Customer-specific role assignments must never confer global authority.
  // Legacy backend app_roles are deliberately not treated as global roles.
  const role: AccessLevel | null = globalRole === 'backend'
    ? 'backend'
    : user.role === 'backend' ? null : user.role

  if (!role) {
    throw new Error('No authorized customer or platform role assigned')
  }

  return {
    id: user.id,
    email: user.email,
    role,
  }
}

export async function requireRole(
  allowedRoles: AccessLevel[]
): Promise<AuthorizedUser> {
  const user = await requireActiveUser()

  if (!allowedRoles.includes(user.role)) {
    throw new Error('Insufficient permissions')
  }

  return user
}