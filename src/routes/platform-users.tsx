import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getPlatformNavigationRole } from '@/lib/platform-navigation.functions'
import { listPlatformUsers, setPlatformUserRole, type PlatformDirectoryUser } from '@/lib/platform-users.functions'

export const Route = createFileRoute('/platform-users')({ component: PlatformUsers })
function PlatformUsers() {
  const [role, setRole] = useState<'support' | 'backend' | null>(null)
  const [users, setUsers] = useState<PlatformDirectoryUser[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const reload = async () => setUsers(await listPlatformUsers())
  useEffect(() => {
    getPlatformNavigationRole().then(result => {
      setRole(result.role)
      if (result.role) return reload()
      setError('Platform authorization required')
    }).catch(e => setError(e instanceof Error ? e.message : 'Unable to load platform users'))
  }, [])
  const update = async (id: string, next: 'support' | 'backend' | 'none') => {
    setBusy(id)
    try { await setPlatformUserRole({ data: { userId: id, role: next } }); await reload(); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Role update failed') }
    finally { setBusy(null) }
  }
  return <main className="mx-auto max-w-4xl space-y-5 p-8">
    <a className="text-sm underline" href="/platform-customers">Back to Platform Customers</a>
    <h1 className="text-2xl font-semibold">Platform User Management</h1>
    <p className="text-sm text-muted-foreground">Global Support and Backend roles are assigned here, not within customer user management.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {role && users.map(user => <div key={user.id} className="flex items-center justify-between gap-3 rounded-md border p-4">
      <div><p className="font-medium">{user.name || user.email}</p><p className="text-sm text-muted-foreground">{user.email}</p></div>
      {role === 'backend' ? <select aria-label={`Platform role for ${user.email}`} className="rounded border bg-background p-2" value={user.role || 'none'} disabled={busy === user.id} onChange={e => void update(user.id, e.target.value as 'support' | 'backend' | 'none')}>
        <option value="none">No global role</option><option value="support">Support</option><option value="backend">Backend</option>
      </select> : <span>{user.role || 'No global role'}</span>}
    </div>)}
  </main>
}
