import { blink } from '@/blink/client'
import type { AccessLevel } from '@/lib/access-control'

interface PendingInvitation {
  id: string
  email: string
  displayName: string
  requestedRole: AccessLevel
  invitedBy: string
  createdAt: string
  updatedAt: string
}

interface DirectoryUser {
  id: string
  email: string
  displayName?: string | null
  createdAt: string
}

interface AppRole {
  id: string
  userId: string
  role: AccessLevel
  createdAt: string
  updatedAt: string
}

export async function reconcileCurrentUser() {
  const state = await new Promise<any>((resolve) => {
    let settled = false

    const unsubscribe = blink.auth.onAuthStateChanged((nextState) => {
      if (settled) return

      if (!nextState.isLoading) {
        settled = true
        unsubscribe()
        resolve(nextState)
      }
    })
  })

  const authUser = state.user

  if (!authUser?.id || !authUser.email) {
    return null
  }

  const usersTable = blink.db.table<DirectoryUser>('users')
  const rolesTable = blink.db.table<AppRole>('app_roles')
  const invitationsTable =
    blink.db.table<PendingInvitation>('pending_user_invitations')

  const email = authUser.email.toLowerCase()

  const [existingUsers, invitations, existingRoles] =
    await Promise.all([
      usersTable.list({
        where: { id: authUser.id },
        limit: 1,
      }),
      invitationsTable.list({
        where: { email },
        limit: 1,
      }),
      rolesTable.list({
        where: { userId: authUser.id },
        limit: 1,
      }),
    ])

  const invitation = invitations[0]
  const existingUser = existingUsers[0]
  const existingRole = existingRoles[0]

  const now = new Date().toISOString()

  /*
   * Make sure the application users directory has a row
   * for the authenticated Blink account.
   */
  if (!existingUser) {
    await usersTable.create({
      id: authUser.id,
      email: authUser.email,
      displayName:
        authUser.displayName ||
        authUser.email.split('@')[0],
      createdAt: now,
    })
  }

  /*
   * If this account was invited, assign the requested
   * SafeGuard role exactly once.
   */
  if (invitation && !existingRole) {
    await rolesTable.create({
      id: crypto.randomUUID(),
      userId: authUser.id,
      role: invitation.requestedRole,
      createdAt: now,
      updatedAt: now,
    })

    await invitationsTable.delete(invitation.id)

    return invitation.requestedRole
  }

  return existingRole?.role || null
}