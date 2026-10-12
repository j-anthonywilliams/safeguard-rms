
import { getSession } from './auth'
import { getDb } from './db.server'
import type { AccessLevel } from './access-control'

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

  if (!user.role) {
    throw new Error('No application role assigned')
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
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