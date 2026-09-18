import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { blink } from '@/blink/client'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ArrowLeft, KeyRound, LogIn, RefreshCw, Search, ShieldCheck, Trash2, UserRound, Users } from 'lucide-react'
import { ACCESS_LABELS, ACCESS_LEVELS, canManageUsers } from '@/lib/access-control'
import type { AccessLevel } from '@/lib/access-control'

interface DirectoryUser { id: string; email: string; displayName?: string; phone?: string; emailVerified?: string | number; lastSignIn?: string; createdAt: string }
interface AppRole { id: string; userId: string; role: AccessLevel; createdAt: string; updatedAt: string }

const ROLE_STARTERS: Array<{ role: AccessLevel; name: string; email: string; description: string }> = [
  { role: 'user', name: 'SafeGuard User', email: 'user@safeguard.local', description: 'Standard report and inventory access.' },
  { role: 'supervisor', name: 'SafeGuard Supervisor', email: 'supervisor@safeguard.local', description: 'Review and approval access.' },
  { role: 'admin', name: 'SafeGuard Administrator', email: 'admin@safeguard.local', description: 'Administrative directory access.' },
  { role: 'support', name: 'SafeGuard Support', email: 'support@safeguard.local', description: 'Support and read-only operations.' },
  { role: 'backend', name: 'SafeGuard Backend', email: 'backend@safeguard.local', description: 'System integration access.' },
]

export const Route = createFileRoute('/app/users')({
  head: () => ({ meta: [{ title: 'User management · SafeGuard RMS' }, { name: 'description', content: 'Review SafeGuard RMS users and access levels.' }] }),
  component: () => <BlinkClientBoundary fallback={<LoadingShell />}><UserManagementPage /></BlinkClientBoundary>,
})

function LoadingShell() { return <div className="flex min-h-dvh items-center justify-center bg-background"><ShieldCheck className="size-5 animate-pulse text-primary" /></div> }

function UserManagementPage() {
  const [currentUser, setCurrentUser] = useState<{ id: string; displayName?: string; email?: string } | null>(null)
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('user')
  const [authLoading, setAuthLoading] = useState(true)
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [roles, setRoles] = useState<AppRole[]>([])
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<AccessLevel>('user')
  const [busy, setBusy] = useState(false)
  const usersTable = useMemo(() => blink.db.table<DirectoryUser>('users'), [])
  const rolesTable = useMemo(() => blink.db.table<AppRole>('app_roles'), [])

  useEffect(() => blink.auth.onAuthStateChanged((state) => {
    setCurrentUser(state.user)
    if (!state.isLoading) setAuthLoading(false)
  }), [])

  useEffect(() => {
    if (!currentUser) return
    rolesTable.list({ where: { userId: currentUser.id }, limit: 1 }).then(rows => setAccessLevel(rows[0]?.role || 'user')).catch(() => setAccessLevel('user'))
  }, [currentUser, rolesTable])

  useEffect(() => {
    if (!currentUser || !canManageUsers(accessLevel)) return
    Promise.all([usersTable.list({ orderBy: { createdAt: 'desc' }, limit: 100 }), rolesTable.list({ limit: 100 })])
      .then(([userRows, roleRows]) => { setUsers(userRows); setRoles(roleRows) })
      .catch((error: Error) => toast.error('Could not load user directory', { description: error.message }))
  }, [accessLevel, currentUser, rolesTable, usersTable])

  const roleByUser = useMemo(() => new Map(roles.map(item => [item.userId, item.role])), [roles])
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users.filter(item => !query || `${item.displayName || ''} ${item.email}`.toLowerCase().includes(query))
  }, [search, users])

  const refreshDirectory = async () => {
    try {
      await refreshDirectoryData()
      toast.success('Directory refreshed')
    } catch (error) { toast.error('Could not refresh directory', { description: error instanceof Error ? error.message : 'Please try again.' }) }
  }

  const refreshDirectoryData = async () => {
    const [userRows, roleRows] = await Promise.all([usersTable.list({ orderBy: { createdAt: 'desc' }, limit: 100 }), rolesTable.list({ limit: 100 })])
    setUsers(userRows)
    setRoles(roleRows)
  }

  const sendLoginLink = async (email: string) => {
    try {
      await blink.auth.sendMagicLink(email)
      toast.success('Passwordless login link sent', { description: `Check ${email} to continue.` })
    } catch (error) { toast.error('Could not send login link', { description: error instanceof Error ? error.message : 'Please try again.' }) }
  }

  const assignRole = async (userId: string, role: AccessLevel) => {
    const existing = roles.find(item => item.userId === userId)
    try {
      if (existing) await rolesTable.update(existing.id, { role, updatedAt: new Date().toISOString() })
      else await rolesTable.create({ id: crypto.randomUUID(), userId, role, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      await refreshDirectory()
      toast.success('Permission updated')
    } catch (error) { toast.error('Could not update permissions', { description: error instanceof Error ? error.message : 'Please try again.' }) }
  }

  const createAccount = async () => {
    if (!newEmail.trim() || busy) return
    setBusy(true)
    try {
      await sendLoginLink(newEmail.trim().toLowerCase())
      setNewName(''); setNewEmail('')
    } finally { setBusy(false) }
  }

  const deleteAccount = (item: DirectoryUser) => {
    toast.error('Account deletion requires the authentication service', { description: 'The managed users table is protected from browser-side deletion.' })
  }

  const explainProtectedAction = (action: string) => {
    toast.error(`${action} requires protected account administration`, { description: 'This project does not expose a safe browser-side path for managed authentication changes.' })
  }

  if (authLoading) return <LoadingShell />
  if (!currentUser) return <AccessDenied message="Please sign in to continue." />
  if (!canManageUsers(accessLevel)) return <AccessDenied message="User management is available to admin, support, and backend users." />

  return <main className="min-h-dvh bg-background px-4 py-6 md:px-8 md:py-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Administration / Directory</p><h1 className="mt-2 font-serif text-3xl tracking-tight">User management</h1><p className="mt-2 text-sm text-muted-foreground">Review account identity, verification, and assigned SafeGuard access levels.</p></div><Button variant="outline" onClick={() => window.location.assign('/app')}><ArrowLeft className="size-4" />Back to command center</Button></div>
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4 text-primary" />Role starter accounts</CardTitle><CardDescription>Five named account slots are ready for passwordless provisioning.</CardDescription></div>
          <Button variant="outline" size="sm" onClick={refreshDirectory}><RefreshCw className="size-3.5" />Refresh</Button>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {ROLE_STARTERS.map(starter => {
            const account = users.find(item => item.email.toLowerCase() === starter.email)
            return <div key={starter.role} className="rounded-lg border border-border bg-muted/20 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">{starter.name}</p><p className="mt-1 font-mono text-[10px] text-primary">{ACCESS_LABELS[starter.role]}</p></div><span className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase ${account ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>{account ? 'Ready' : 'Setup'}</span></div><p className="mt-3 break-all text-xs text-muted-foreground">{starter.email}</p><p className="mt-2 min-h-8 text-xs text-muted-foreground">{starter.description}</p><Button className="mt-4 w-full" size="sm" variant="outline" onClick={() => sendLoginLink(starter.email)}><LogIn className="size-3.5" />Send login link</Button></div>
          })}
        </CardContent>
      </Card>
      <Card><CardHeader className="flex flex-col gap-4 border-b border-border md:flex-row md:items-end md:justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><Users className="size-4 text-primary" />User directory</CardTitle><CardDescription className="mt-1">{users.length} account{users.length === 1 ? '' : 's'} · signed in as {ACCESS_LABELS[accessLevel]}</CardDescription></div><div className="relative w-full md:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or email" aria-label="Search users" /></div></CardHeader><CardContent className="p-0"><div className="divide-y divide-border">{filteredUsers.length ? filteredUsers.map(item => { const role = roleByUser.get(item.id) || 'user'; return <div key={item.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-4" /></div><div className="min-w-0"><p className="truncate text-sm font-medium">{item.displayName || 'Unnamed user'} {item.id === currentUser.id && <span className="text-xs text-muted-foreground">(you)</span>}</p><p className="truncate text-xs text-muted-foreground">{item.email}</p></div></div><div className="flex flex-wrap items-center gap-2"><select value={role} disabled title="Role changes require protected account administration" onChange={() => explainProtectedAction('Permission changes')} className="h-9 rounded-md border border-input bg-muted px-3 text-xs opacity-70" aria-label={`Permission for ${item.displayName || item.email}`}>{ACCESS_LEVELS.map(level => <option key={level} value={level}>{ACCESS_LABELS[level]}</option>)}</select><span className="text-xs text-muted-foreground">{Number(item.emailVerified) ? 'Verified' : 'Unverified'}</span><Button size="sm" variant="outline" onClick={() => sendLoginLink(item.email)}><LogIn className="size-3.5" />Login link</Button><Button size="sm" variant="ghost" onClick={() => explainProtectedAction('Account deletion')} disabled={item.id === currentUser.id} aria-label={`Delete ${item.displayName || item.email}`}><Trash2 className="size-3.5 text-destructive" /></Button></div></div> }) : <div className="px-5 py-12 text-center text-sm text-muted-foreground">No users match your search.</div>}</div></CardContent></Card>
      <p className="text-xs text-muted-foreground">Passwordless login links are available now. The five starter identities are a provisioning checklist, not fabricated users: managed accounts, role writes, deletion, and true impersonation must be completed through protected account administration rather than browser code.</p>
    </div>
  </main>
}

function AccessDenied({ message }: { message: string }) { return <main className="flex min-h-dvh items-center justify-center bg-background px-6"><Card className="w-full max-w-md"><CardHeader><ShieldCheck className="size-6 text-primary" /><CardTitle className="mt-3">Access restricted</CardTitle><CardDescription>{message}</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={() => window.location.assign('/app')}>Return to command center</Button></CardContent></Card></main> }
