import { createServerFn } from '@tanstack/react-start'
import { getDb } from '@/lib/db.server'
import { requireRole } from '@/lib/authorization.server'
import { getCustomerContext } from '@/lib/customer-context.server'

export type LogKind = 'evidence' | 'property'
export interface LogRecord { id: string; itemNumber: string; description: string; location: string; status: string; incidentId: string | null; createdAt: string; userId: string }
const allowed = ['user', 'supervisor', 'admin', 'backend'] as const
const propertyAllowed = ['user', 'office_staff', 'supervisor', 'admin', 'backend'] as const

export const listLogRecords = createServerFn({ method: 'GET' })
  .inputValidator((data: { kind: LogKind }) => data)
  .handler(async ({ data }) => {
    const user = await requireRole(data.kind === 'property' ? [...propertyAllowed] : [...allowed])
    const customer = await getCustomerContext()
    const db = getDb()
    if (data.kind === 'evidence') {
      const result = await db.query<LogRecord>(`SELECT id, user_id AS "userId", item_number AS "itemNumber", description, location, status, incident_id AS "incidentId", created_at AS "createdAt" FROM evidence WHERE customer_id = $1 AND (user_id = $2 OR $3 IN ('admin','backend')) ORDER BY created_at DESC LIMIT 500`, [customer.id, user.id, user.role])
      return result.rows
    }
    const result = await db.query<LogRecord>(`SELECT id, user_id AS "userId", item_number AS "itemNumber", description, location, status, NULL::text AS "incidentId", created_at AS "createdAt" FROM property_log WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 500`, [customer.id])
    return result.rows
  })

export const saveLogRecord = createServerFn({ method: 'POST' })
  .inputValidator((data: { kind: LogKind; id: string | null; itemNumber: string; description: string; location: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireRole(data.kind === 'property' ? [...propertyAllowed] : [...allowed])
    const customer = await getCustomerContext()
    const db = getDb()
    const itemNumber = data.itemNumber.trim()
    const description = data.description.trim()
    const location = data.location.trim()
    if (!itemNumber || !description || !location || itemNumber.length > 120 || description.length > 10000 || location.length > 500) throw new Error('Valid item number, description and location required')
    if (data.id) {
      const table = data.kind === 'evidence' ? 'evidence' : 'property_log'
      const result = await db.query(`UPDATE ${table} SET description = $1, location = $2 WHERE id = $3 AND customer_id = $4 AND (user_id = $5 OR $6 IN ('admin','backend') OR ($6 = 'office_staff' AND $7 = 'property')) RETURNING id`, [description, location, data.id, customer.id, user.id, user.role, data.kind])
      if (!result.rowCount) throw new Error('Record not found or update not authorized')
      return { id: data.id }
    }
    if (data.kind === 'evidence') throw new Error('Use the existing evidence intake workflow to create evidence with initial custody history')
    const id = crypto.randomUUID()
    await db.query(`INSERT INTO property_log (id, customer_id, user_id, item_number, description, location, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,'In custody',$7)`, [id, customer.id, user.id, itemNumber, description, location, new Date().toISOString()])
    return { id }
  })
