import { createServerFn } from '@tanstack/react-start'
import { getDb } from './db.server'
import { getSession } from './auth'

export interface UserDirectoryRecord {
  id: string
  email: string
  displayName: string | null
  phone: string | null
  emailVerified: number
  lastSignIn: string | null
  createdAt: string
  updatedAt: string
  isArchived: number
  archivedAt: string | null
  archivedBy: string | null
}

export interface UserRoleRecord {
  id: string
  userId: string
  role: 'user' | 'supervisor' | 'admin' | 'support' | 'backend'
  createdAt: string
  updatedAt: string
}

export interface PendingInvitationRecord {
  id: string
  email: string
  displayName: string
  requestedRole: 'user' | 'supervisor' | 'admin' | 'support' | 'backend'
  invitedBy: string
  createdAt: string
  updatedAt: string
}

export const getUserDirectory = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = getDb()

    const [usersResult, rolesResult, invitationsResult] =
      await Promise.all([
        db.query<UserDirectoryRecord>(`
          SELECT
            id,
            email,
            display_name AS "displayName",
            phone,
            email_verified AS "emailVerified",
            last_sign_in AS "lastSignIn",
            created_at AS "createdAt",
            updated_at AS "updatedAt",
            is_archived AS "isArchived",
            archived_at AS "archivedAt",
            archived_by AS "archivedBy"
          FROM users
          ORDER BY created_at DESC
          LIMIT 100
        `),

        db.query<UserRoleRecord>(`
          SELECT
            id,
            user_id AS "userId",
            role,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM app_roles
          ORDER BY created_at ASC
          LIMIT 100
        `),

        db.query<PendingInvitationRecord>(`
          SELECT
            id,
            email,
            display_name AS "displayName",
            requested_role AS "requestedRole",
            invited_by AS "invitedBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM pending_user_invitations
          ORDER BY created_at DESC
          LIMIT 100
        `),
      ])

    return {
        users: usersResult.rows,
        roles: rolesResult.rows,
        pendingInvitations: invitationsResult.rows,
        userCount: usersResult.rowCount ?? usersResult.rows.length,
        roleCount: rolesResult.rowCount ?? rolesResult.rows.length,
        invitationCount:
            invitationsResult.rowCount ?? invitationsResult.rows.length,
        }
  },
)

export const getCurrentUserRole = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await getSession()

    if (!session?.user) {
      return { role: 'user' as const }
    }

    const db = getDb()

    const result = await db.query<{ role: UserRoleRecord['role'] }>(
      `
        SELECT role
        FROM app_roles
        WHERE user_id = $1
        LIMIT 1
      `,
      [session.user.id],
    )

    return {
      role: result.rows[0]?.role ?? 'user',
    }
  },
)