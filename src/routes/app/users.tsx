import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { blink } from '@/blink/client'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import {
  Button,
} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  ArrowLeft,
  LogIn,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import {
  ACCESS_LABELS,
  ACCESS_LEVELS,
  canGrantRole,
  canManageUsers,
} from '@/lib/access-control'
import type { AccessLevel } from '@/lib/access-control'

interface DirectoryUser {
  id: string
  email: string
  displayName?: string | null
  phone?: string | null
  emailVerified?: string | number
  lastSignIn?: string | null
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

export const Route = createFileRoute('/app/users')({
  head: () => ({
    meta: [
      {
        title: 'User management · SafeGuard RMS',
      },
      {
        name: 'description',
        content:
          'Manage SafeGuard RMS users and access assignments.',
      },
    ],
  }),
  component: () => (
    <BlinkClientBoundary fallback={<LoadingShell />}>
      <UserManagementPage />
    </BlinkClientBoundary>
  ),
})

function LoadingShell() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <ShieldCheck className="size-5 animate-pulse" />
    </div>
  )
}

function UserManagementPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string
    displayName?: string
    email?: string
  } | null>(null)

  const [accessLevel, setAccessLevel] =
    useState<AccessLevel>('user')

  const [authLoading, setAuthLoading] = useState(true)
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [roles, setRoles] = useState<AppRole[]>([])
  const [pendingInvitations, setPendingInvitations] =
    useState<PendingInvitation[]>([])

  const [search, setSearch] = useState('')

  const [showAddUser, setShowAddUser] =
    useState(false)

  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] =
    useState<AccessLevel>('user')

  const [busy, setBusy] = useState(false)

  const usersTable = useMemo(
    () => blink.db.table<DirectoryUser>('users'),
    []
  )

  const rolesTable = useMemo(
    () => blink.db.table<AppRole>('app_roles'),
    []
  )

  const invitationsTable = useMemo(
    () =>
      blink.db.table<PendingInvitation>(
        'pending_user_invitations'
      ),
    []
  )

  useEffect(() => {
    return blink.auth.onAuthStateChanged((state) => {
      setCurrentUser(state.user)

      if (!state.isLoading) {
        setAuthLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    if (!currentUser) return

    rolesTable
      .list({
        where: {
          userId: currentUser.id,
        },
        limit: 1,
      })
      .then(rows =>
        setAccessLevel(rows[0]?.role || 'user')
      )
      .catch(() => setAccessLevel('user'))
  }, [currentUser, rolesTable])

  const loadDirectory = async () => {
    if (!currentUser) return

    const [userRows, roleRows, invitationRows] =
      await Promise.all([
        usersTable.list({
          orderBy: {
            createdAt: 'desc',
          },
          limit: 500,
        }),
        rolesTable.list({
          limit: 500,
        }),
        invitationsTable.list({
          limit: 500,
        }),
      ])

    setUsers(userRows)
    setRoles(roleRows)
    setPendingInvitations(invitationRows)
  }

  useEffect(() => {
    if (
      !currentUser ||
      !canManageUsers(accessLevel)
    ) {
      return
    }

    loadDirectory().catch((error: Error) => {
      toast.error('Could not load user directory', {
        description: error.message,
      })
    })
  }, [
    accessLevel,
    currentUser,
    rolesTable,
    usersTable,
    invitationsTable,
  ])

  const roleByUser = useMemo(
    () =>
      new Map(
        roles.map(item => [item.userId, item.role])
      ),
    [roles]
  )

  const grantableRoles = useMemo(
    () => ACCESS_LEVELS.filter(
      role => canGrantRole(accessLevel, role)
    ),
    [accessLevel]
  )

  useEffect(() => {
    if (
      grantableRoles.length > 0 &&
      !grantableRoles.includes(newRole)
    ) {
      setNewRole(grantableRoles[0])
    }
  }, [grantableRoles, newRole])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return users.filter(item =>
      !query ||
      `${item.displayName || ''} ${item.email}`
        .toLowerCase()
        .includes(query)
    )
  }, [search, users])

  const refreshDirectory = async () => {
    try {
      await loadDirectory()
      toast.success('Directory refreshed')
    } catch (error) {
      toast.error('Could not refresh directory', {
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      })
    }
  }

  const sendLoginLink = async (
    email: string
  ) => {
    try {
      await blink.auth.sendMagicLink(email)

      toast.success('Login link sent', {
        description:
          `A secure login link was sent to ${email}.`,
      })
    } catch (error) {
      toast.error('Could not send login link', {
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      })
    }
  }

  const updateRole = async (
    user: DirectoryUser,
    targetRole: AccessLevel
  ) => {
    const currentRole =
      roleByUser.get(user.id) || 'user'

    if (
      user.id !== currentUser?.id &&
      !canGrantRole(accessLevel, targetRole)
    ) {
      toast.error('Not authorized', {
        description:
          `You cannot grant ${ACCESS_LABELS[targetRole]} access.`,
      })
      return
    }

    if (
      user.id === currentUser?.id &&
      targetRole !== currentRole
    ) {
      toast.error('You cannot change your own access', {
        description:
          'Another authorized administrator must change your access level.',
      })
      return
    }

    if (targetRole === currentRole) return

    const existing = roles.find(
      item => item.userId === user.id
    )

    try {
      setBusy(true)

      const now = new Date().toISOString()

      if (existing) {
        await rolesTable.update(existing.id, {
          role: targetRole,
          updatedAt: now,
        })
      } else {
        await rolesTable.create({
          id: crypto.randomUUID(),
          userId: user.id,
          role: targetRole,
          createdAt: now,
          updatedAt: now,
        })
      }

      await refreshDirectory()

      toast.success('Permission updated', {
        description:
          `${user.displayName || user.email} is now ${ACCESS_LABELS[targetRole]}.`,
      })
    } catch (error) {
      toast.error('Could not update permissions', {
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  const createInvitation = async () => {
    const email = newEmail.trim().toLowerCase()
    const name = newName.trim()

    if (!name || !email || busy) {
      return
    }

    if (!canGrantRole(accessLevel, newRole)) {
      toast.error('Not authorized', {
        description:
          `You cannot grant ${ACCESS_LABELS[newRole]} access.`,
      })
      return
    }

    const existingUser = users.find(
      item => item.email.toLowerCase() === email
    )

    if (existingUser) {
      toast.error('User already exists', {
        description:
          'Use the existing user record to change permissions.',
      })
      return
    }

    const existingInvitation =
      pendingInvitations.find(
        item => item.email.toLowerCase() === email
      )

    try {
      setBusy(true)

      const now = new Date().toISOString()

      if (existingInvitation) {
        await invitationsTable.update(
          existingInvitation.id,
          {
            displayName: name,
            requestedRole: newRole,
            invitedBy: currentUser?.id || '',
            updatedAt: now,
          }
        )
      } else {
        await invitationsTable.create({
          id: crypto.randomUUID(),
          email,
          displayName: name,
          requestedRole: newRole,
          invitedBy: currentUser?.id || '',
          createdAt: now,
          updatedAt: now,
        })
      }

      await sendLoginLink(email)

      setNewName('')
      setNewEmail('')
      setNewRole(
        grantableRoles[0] || 'user'
      )
      setShowAddUser(false)

      await refreshDirectory()
    } catch (error) {
      toast.error('Could not create invitation', {
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  const removeInvitation = async (
    invitation: PendingInvitation
  ) => {
    try {
      setBusy(true)

      await invitationsTable.delete(
        invitation.id
      )

      await refreshDirectory()

      toast.success('Invitation removed')
    } catch (error) {
      toast.error('Could not remove invitation', {
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  if (authLoading) {
    return <LoadingShell />
  }

  if (!currentUser) {
    return (
      <AccessDenied message="Please sign in to continue." />
    )
  }

  if (!canManageUsers(accessLevel)) {
    return (
      <AccessDenied
        message="User management is available to admin, support, and backend users."
      />
    )
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              Administration / Directory
            </p>

            <h1 className="mt-2 font-serif text-3xl tracking-tight">
              User management
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Manage SafeGuard users and their application access.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                window.location.assign('/app')
              }
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>

            {grantableRoles.length > 0 && (
              <Button
                onClick={() =>
                  setShowAddUser(true)
                }
              >
                <Plus className="size-4" />
                Add user
              </Button>
            )}
          </div>
        </div>

        {showAddUser && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Add user</CardTitle>
                  <CardDescription>
                    Invite a user and assign the SafeGuard access level
                    you are authorized to grant.
                  </CardDescription>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setShowAddUser(false)
                  }
                  aria-label="Close add user form"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-xs font-medium">
                  Display name
                </span>

                <Input
                  value={newName}
                  onChange={event =>
                    setNewName(event.target.value)
                  }
                  placeholder="Jane Smith"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium">
                  Email
                </span>

                <Input
                  type="email"
                  value={newEmail}
                  onChange={event =>
                    setNewEmail(event.target.value)
                  }
                  placeholder="jane.smith@example.com"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium">
                  Access level
                </span>

                <select
                  value={newRole}
                  onChange={event =>
                    setNewRole(
                      event.target.value as AccessLevel
                    )
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {grantableRoles.map(role => (
                    <option
                      key={role}
                      value={role}
                    >
                      {ACCESS_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-3 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setShowAddUser(false)
                  }
                  disabled={busy}
                >
                  Cancel
                </Button>

                <Button
                  onClick={createInvitation}
                  disabled={
                    busy ||
                    !newName.trim() ||
                    !newEmail.trim() ||
                    !canGrantRole(
                      accessLevel,
                      newRole
                    )
                  }
                >
                  <LogIn className="size-4" />
                  {busy
                    ? 'Sending invitation…'
                    : 'Create & send login link'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" />
                User directory
              </CardTitle>

              <CardDescription className="mt-1">
                {users.length} account
                {users.length === 1 ? '' : 's'} · signed in as{' '}
                {ACCESS_LABELS[accessLevel]}
              </CardDescription>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshDirectory}
              >
                <RefreshCw className="size-3.5" />
                Refresh
              </Button>

              <div className="relative w-full md:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  className="pl-9"
                  value={search}
                  onChange={event =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search name or email"
                  aria-label="Search users"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filteredUsers.length ? (
                filteredUsers.map(item => {
                  const role =
                    roleByUser.get(item.id) ||
                    'user'

                  const permittedRoles =
                    ACCESS_LEVELS.filter(
                      level =>
                        level === role ||
                        canGrantRole(
                          accessLevel,
                          level
                        )
                    )

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <UserRound className="size-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {item.displayName ||
                              'Unnamed user'}{' '}
                            {item.id === currentUser.id && (
                              <span className="text-xs text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </p>

                          <p className="truncate text-xs text-muted-foreground">
                            {item.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={role}
                          disabled={
                            item.id === currentUser.id ||
                            busy
                          }
                          onChange={event =>
                            updateRole(
                              item,
                              event.target.value as AccessLevel
                            )
                          }
                          className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                          aria-label={`Permission for ${
                            item.displayName ||
                            item.email
                          }`}
                        >
                          {permittedRoles.map(
                            level => (
                              <option
                                key={level}
                                value={level}
                              >
                                {ACCESS_LABELS[level]}
                              </option>
                            )
                          )}
                        </select>

                        <span className="text-xs text-muted-foreground">
                          {Number(item.emailVerified)
                            ? 'Verified'
                            : 'Unverified'}
                        </span>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            sendLoginLink(
                              item.email
                            )
                          }
                          disabled={busy}
                        >
                          <LogIn className="size-3.5" />
                          Login link
                        </Button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No users match your search.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {pendingInvitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending invitations</CardTitle>
              <CardDescription>
                Users who have been invited but are not yet
                present in the SafeGuard directory.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {pendingInvitations.map(invitation => (
                  <div
                    key={invitation.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {invitation.displayName}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {invitation.email}
                      </p>

                      <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-primary">
                        {ACCESS_LABELS[
                          invitation.requestedRole
                        ]}{' '}
                        access
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          sendLoginLink(
                            invitation.email
                          )
                        }
                        disabled={busy}
                      >
                        <LogIn className="size-3.5" />
                        Resend link
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          removeInvitation(
                            invitation
                          )
                        }
                        disabled={busy}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}

function AccessDenied({
  message,
}: {
  message: string
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <ShieldCheck className="size-6 text-primary" />

          <CardTitle className="mt-3">
            Access restricted
          </CardTitle>

          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Button
            variant="outline"
            onClick={() =>
              window.location.assign('/app')
            }
          >
            Return to command center
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}