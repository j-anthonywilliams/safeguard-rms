import { createServerFn } from '@tanstack/react-start'
import { getPlatformDb } from '@/lib/platform-db.server'
import { requireGlobalPlatformIdentity } from '@/lib/platform-global-identity.server'

export interface PlatformDirectoryUser {
  id: string
  email: string
  name: string
  role: 'support' | 'backend' | null
}

export const listPlatformUsers = createServerFn({ method: 'GET' }).handler(async () => {
  await requireGlobalPlatformIdentity()
  const result = await getPlatformDb().query<PlatformDirectoryUser>(`
    SELECT u.id, u.email, u.name,
      CASE WHEN EXISTS (SELECT 1 FROM platform_user_roles r WHERE r.user_id = u.id AND r.platform_role = 'backend') THEN 'backend'
           WHEN EXISTS (SELECT 1 FROM platform_user_roles r WHERE r.user_id = u.id AND r.platform_role = 'support') THEN 'support'
           ELSE NULL END AS role
    FROM "user" u ORDER BY u.email LIMIT 200
  `)
  return result.rows
})

export const setPlatformUserRole = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; role: 'support' | 'backend' | 'none' }) => data)
  .handler(async ({ data }) => {
    const actor = await requireGlobalPlatformIdentity()
    if (actor.role !== 'backend') throw new Error('Backend authority required')
    if (!data.userId || !['support', 'backend', 'none'].includes(data.role)) throw new Error('Invalid role change')
    if (actor.platformUserId === data.userId) throw new Error('Cannot modify your own platform role')
    const db = getPlatformDb()
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const target = await client.query('SELECT id FROM "user" WHERE id = $1 FOR UPDATE', [data.userId])
      if (!target.rowCount) throw new Error('Platform user not found')
      await client.query('DELETE FROM platform_user_roles WHERE user_id = $1', [data.userId])
      if (data.role !== 'none') {
        await client.query('INSERT INTO platform_user_roles (id, user_id, platform_role) VALUES ($1, $2, $3)', [crypto.randomUUID(), data.userId, data.role])
      }
      await client.query('COMMIT')
      return { ok: true }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  })
