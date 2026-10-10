import { createServerFn } from '@tanstack/react-start'
import { getDb } from './db.server'
import { getSession } from './auth'
import { randomUUID } from 'node:crypto'
import { canGrantRole } from './access-control'
import type { AccessLevel } from './access-control'

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
    const session = await getSession()

    if (!session?.user) {
      throw new Error('Authentication required')
    }

    const db = getDb()

    const roleResult = await db.query<{
      role: UserRoleRecord['role']
    }>(
      `
        SELECT role
        FROM app_roles
        WHERE user_id = $1
        LIMIT 1
      `,
      [session.user.id]
    )

    const currentRole = roleResult.rows[0]?.role ?? 'user'

    if (!['admin', 'support', 'backend'].includes(currentRole)) {
      throw new Error(
        'You are not authorized to access the user directory'
      )
    }

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

export const updateUserRole = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { userId: string; role: AccessLevel }) => data
  )
  .handler(async ({ data }) => {
    const session = await getSession()

    if (!session?.user) {
      throw new Error('Authentication required')
    }

    const db = getDb()

    const currentRoleResult = await db.query<{
      role: AccessLevel
    }>(
      `
        SELECT role
        FROM app_roles
        WHERE user_id = $1
        LIMIT 1
      `,
      [session.user.id]
    )

    const currentRole =
      currentRoleResult.rows[0]?.role ?? 'user'

    if (!canGrantRole(currentRole, data.role)) {
      throw new Error(
        'You are not authorized to assign this role'
      )
    }

    if (data.userId === session.user.id) {
      throw new Error(
        'You cannot change your own access level'
      )
    }

    const targetRoleResult = await db.query<{
      role: AccessLevel
    }>(
      `
        SELECT role
        FROM app_roles
        WHERE user_id = $1
        LIMIT 1
      `,
      [data.userId]
    )

    const existingTargetRole =
      targetRoleResult.rows[0]?.role ?? 'user'

    if (!canGrantRole(currentRole, existingTargetRole)) {
      throw new Error(
        'You are not authorized to modify this user'
      )
    }
    const targetUser = await db.query(
      `
        SELECT id
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [data.userId]
    )

    if (targetUser.rows.length === 0) {
      throw new Error('User not found')
    }

    const now = new Date().toISOString()

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
        ON CONFLICT (user_id)
        DO UPDATE SET
          role = EXCLUDED.role,
          updated_at = EXCLUDED.updated_at
      `,
      [
        randomUUID(),
        data.userId,
        data.role,
        now,
      ]
    )

    return {
      success: true,
      role: data.role,
    }
  })

export const updateUserProfile = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      userId: string
      displayName: string
      phone: string
    }) => data
  )
  .handler(async ({ data }) => {
    const session = await getSession()

    if (!session?.user) {
      throw new Error('Authentication required')
    }

    const db = getDb()

    const roleResult = await db.query<{
      role: UserRoleRecord['role']
    }>(
      `
        SELECT role
        FROM app_roles
        WHERE user_id = $1
        LIMIT 1
      `,
      [session.user.id]
    )

    const currentRole = roleResult.rows[0]?.role ?? 'user'

    if (!['admin', 'support', 'backend'].includes(currentRole)) {
      throw new Error('Not authorized to edit user profiles')
    }

    const result = await db.query(
      `
        UPDATE users
        SET
          display_name = $1,
          phone = $2,
          updated_at = $3
        WHERE id = $4
          AND is_archived = 0
        RETURNING id
      `,
      [
        data.displayName.trim(),
        data.phone.trim() || null,
        new Date().toISOString(),
        data.userId,
      ]
    )

    if (result.rowCount === 0) {
      throw new Error('Active user not found')
    }

    return { success: true }
  })

export const archiveUserAccount = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const session = await getSession()

    if (!session?.user) {
      throw new Error('Authentication required')
    }

    if (session.user.id === data.userId) {
      throw new Error('You cannot archive your own account')
    }

    const db = getDb()

    const roleResult = await db.query<{
      role: UserRoleRecord['role']
    }>(
      `SELECT role FROM app_roles WHERE user_id = $1 LIMIT 1`,
      [session.user.id]
    )

    const currentRole = roleResult.rows[0]?.role ?? 'user'

    if (!['admin', 'support', 'backend'].includes(currentRole)) {
      throw new Error('Not authorized to archive users')
    }

    const targetRoleResult = await db.query<{
      role: UserRoleRecord['role']
    }>(
      `SELECT role FROM app_roles WHERE user_id = $1 LIMIT 1`,
      [data.userId]
    )

    const targetRole = targetRoleResult.rows[0]?.role ?? 'user'

    if (!canGrantRole(currentRole, targetRole)) {
      throw new Error('Not authorized to archive this user')
    }

    const result = await db.query(
      `
        UPDATE users
        SET is_archived = 1,
            archived_at = $1,
            archived_by = $2,
            updated_at = $1
        WHERE id = $3 AND is_archived = 0
        RETURNING id
      `,
      [new Date().toISOString(), session.user.id, data.userId]
    )

    if (result.rowCount === 0) {
      throw new Error('Active user not found')
    }

    return { success: true }
  })

export const restoreUserAccount = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const session = await getSession()

    if (!session?.user) {
      throw new Error('Authentication required')
    }

    const db = getDb()

    const roleResult = await db.query<{
      role: UserRoleRecord['role']
    }>(
      `SELECT role FROM app_roles WHERE user_id = $1 LIMIT 1`,
      [session.user.id]
    )

    const currentRole = roleResult.rows[0]?.role ?? 'user'

    if (!['admin', 'support', 'backend'].includes(currentRole)) {
      throw new Error('Not authorized to restore users')
    }

    const targetRoleResult = await db.query<{
      role: UserRoleRecord['role']
    }>(
      `SELECT role FROM app_roles WHERE user_id = $1 LIMIT 1`,
      [data.userId]
    )

    const targetRole = targetRoleResult.rows[0]?.role ?? 'user'

    if (!canGrantRole(currentRole, targetRole)) {
      throw new Error('Not authorized to restore this user')
    }

    const result = await db.query(
      `
        UPDATE users
        SET is_archived = 0,
            archived_at = NULL,
            archived_by = NULL,
            updated_at = $1
        WHERE id = $2 AND is_archived = 1
        RETURNING id
      `,
      [new Date().toISOString(), data.userId]
    )

    if (result.rowCount === 0) {
      throw new Error('Archived user not found')
    }

    return { success: true }
  })