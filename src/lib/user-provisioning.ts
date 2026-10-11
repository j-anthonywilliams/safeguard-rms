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
    throw new Error('Authentication required')
  }

  const db = getDb()
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    const email = authUser.email.trim().toLowerCase()
    const now = new Date().toISOString()

    // Serialize provisioning attempts for this authenticated identity.
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [authUser.id],
    )

    const userResult = await client.query<{
      id: string
      email: string
      is_archived: number
    }>(
      `
        SELECT id, email, is_archived
        FROM users
        WHERE id = $1
        FOR UPDATE
      `,
      [authUser.id],
    )

    const existingUser = userResult.rows[0]

    if (existingUser?.is_archived === 1) {
      throw new Error('This account has been archived')
    }

    const roleResult = await client.query<{
      role: AccessLevel
    }>(
      `
        SELECT role
        FROM app_roles
        WHERE user_id = $1
        FOR UPDATE
      `,
      [authUser.id],
    )

    const existingRole = roleResult.rows[0]?.role

    const invitationResult = await client.query<{
      id: string
      display_name: string
      requested_role: AccessLevel
    }>(
      `
        SELECT id, display_name, requested_role
        FROM pending_user_invitations
        WHERE LOWER(email) = $1
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE
      `,
      [email],
    )

    const invitation = invitationResult.rows[0]

    // Existing authorized accounts retain their assigned permissions.
    if (existingUser && existingRole) {
      await client.query(
        `
          UPDATE users
          SET last_sign_in = $1,
              updated_at = $1
          WHERE id = $2
        `,
        [now, authUser.id],
      )

      await client.query('COMMIT')
      return existingRole
    }

    // New accounts require an invitation and a verified email.
    if (!invitation || !authUser.emailVerified) {
      await client.query('COMMIT')
      return null
    }

    if (!existingUser) {
      await client.query(
        `
          INSERT INTO users (
            id,
            email,
            email_verified,
            display_name,
            created_at,
            updated_at,
            last_sign_in,
            is_archived
          )
          VALUES ($1, $2, 1, $3, $4, $4, $4, 0)
        `,
        [
          authUser.id,
          email,
          invitation.display_name,
          now,
        ],
      )
    }

    if (!existingRole) {
      await client.query(
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
          invitation.requested_role,
          now,
        ],
      )
    }

    await client.query(
      `
        DELETE FROM pending_user_invitations
        WHERE id = $1
      `,
      [invitation.id],
    )

    await client.query('COMMIT')

    return existingRole ?? invitation.requested_role
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
})