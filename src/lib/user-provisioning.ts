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
  const state = await new Promise<{
    user: {
      id: string
      email?: string
      displayName?: string
    } | null
  }>((resolve) => {
    let settled = false

    const unsubscribe = blink.auth.onAuthStateChanged((nextState) => {
      if (settled || nextState.isLoading) {
        return
      }

      settled = true
      unsubscribe()

      resolve({
        user: nextState.user,
      })
    })
  })

  const authUser = state.user

  if (!authUser?.id || !authUser.email) {
    return null
  }

  const usersTable =
    blink.db.table<DirectoryUser>('users')

  const rolesTable =
    blink.db.table<AppRole>('app_roles')

  const invitationsTable =
    blink.db.table<PendingInvitation>(
      'pending_user_invitations'
    )

  const email = authUser.email.toLowerCase()
  const now = new Date().toISOString()

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

  const existingUser = existingUsers[0]
  const invitation = invitations[0]
  const existingRole = existingRoles[0]

  // Make sure the real Blink account exists in the SafeGuard directory.
  if (!existingUser) {
    await usersTable.create({
      id: authUser.id,
      email: authUser.email,
      displayName:
        invitation?.displayName ||
        authUser.displayName ||
        authUser.email.split('@')[0],
      createdAt: now,
    })
  }

  /*
   * Initial provisioning:
   *
   * The invitation's requested role is authoritative the first
   * time this account is provisioned.
   *
   * If Blink/SafeGuard already created a default "user" role,
   * replace that initial role with the invited role.
   */
  if (invitation) {
    if (existingRole) {
      if (existingRole.role !== invitation.requestedRole) {
        await rolesTable.update(existingRole.id, {
          role: invitation.requestedRole,
          updatedAt: now,
        })
      }
    } else {
      await rolesTable.create({
        id: crypto.randomUUID(),
        userId: authUser.id,
        role: invitation.requestedRole,
        createdAt: now,
        updatedAt: now,
      })
    }

    await invitationsTable.delete(invitation.id)

    return invitation.requestedRole
  }

  return existingRole?.role || null
}