import { createServerFn } from '@tanstack/react-start'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db.server'
import type { AccessLevel } from '@/lib/access-control'

interface DirectoryUser {
  id: string
  email: string
  displayName: string | null
  createdAt: string
}

interface AppRole {
  id: string
  userId: string
  role: AccessLevel
  createdAt: string
  updatedAt: string
}

interface PendingInvitation {
  id: string
  email: string
  displayName: string
  requestedRole: AccessLevel
  invitedBy: string
  createdAt: string
  updatedAt: string
}

export const reconcileCurrentUser = createServerFn({
  method: 'POST',
}).handler(async () => {
  const session = await getSession()
  const authUser = session?.user

  if (!authUser?.id || !authUser.email) {
    return null
  }

  const db = getDb()

  const email = authUser.email.toLowerCase()
  const now = new Date().toISOString()

  const [existingUsers, invitations, existingRoles] =
    await Promise.all([
      db.query<DirectoryUser>(
        `
          SELECT
            id,
            email,
            display_name AS "displayName",
            created_at AS "createdAt"
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [authUser.id],
      ),

      db.query<PendingInvitation>(
        `
          SELECT
            id,
            email,
            display_name AS "displayName",
            requested_role AS "requestedRole",
            invited_by AS "invitedBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM pending_user_invitations
          WHERE LOWER(email) = $1
          ORDER BY created_at ASC
          LIMIT 1
        `,
        [email],
      ),

      db.query<AppRole>(
        `
          SELECT
            id,
            user_id AS "userId",
            role,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM app_roles
          WHERE user_id = $1
          LIMIT 1
        `,
        [authUser.id],
      ),
    ])

  const existingUser = existingUsers.rows[0]
  const invitation = invitations.rows[0]
  const existingRole = existingRoles.rows[0]

  if (!existingUser) {
    await db.query(
      `
        INSERT INTO users (
          id,
          email,
          display_name,
          created_at,
          updated_at,
          last_sign_in,
          is_archived
        )
        VALUES ($1, $2, $3, $4, $4, $4, 0)
      `,
      [
        authUser.id,
        authUser.email,
        invitation?.displayName ||
          authUser.name ||
          authUser.email.split('@')[0],
        now,
      ],
    )
  }

  if (invitation) {
    if (existingRole) {
      if (existingRole.role !== invitation.requestedRole) {
        await db.query(
          `
            UPDATE app_roles
            SET role = $1, updated_at = $2
            WHERE id = $3
          `,
          [
            invitation.requestedRole,
            now,
            existingRole.id,
          ],
        )
      }
    } else {
      await db.query(
        `
          INSERT INTO app_roles (
            id,
            user_id,
            role,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $4)
        `,
        [
          crypto.randomUUID(),
          authUser.id,
          invitation.requestedRole,
          now,
        ],
      )
    }

    await db.query(
      `
        DELETE FROM pending_user_invitations
        WHERE id = $1
      `,
      [invitation.id],
    )

    return invitation.requestedRole
  }

  return existingRole?.role || null
})