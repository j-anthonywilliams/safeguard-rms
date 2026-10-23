import { createServerFn } from '@tanstack/react-start'
import { getPlatformDb } from '@/lib/platform-db.server'
import { requirePlatformSession } from '@/lib/platform-auth.server'
import { getPlatformRole } from '@/lib/platform-authorization.server'

async function requireCustomerRegistrar() {
  const session = await requirePlatformSession()
  const role = await getPlatformRole(session.user.id)
  if (role !== 'support' && role !== 'backend') throw new Error('Customer registration not authorized')
  return session
}

export const canRegisterCustomers = createServerFn({ method: 'GET' }).handler(async () => {
  try { await requireCustomerRegistrar(); return true } catch { return false }
})

export const registerPlatformCustomer = createServerFn({ method: 'POST' })
  .inputValidator((data: { customerCode: string; name: string; websiteSlug: string }) => data)
  .handler(async ({ data }) => {
    await requireCustomerRegistrar()
    const customerCode = data.customerCode.trim().toUpperCase()
    const name = data.name.trim()
    const websiteSlug = data.websiteSlug.trim().toLowerCase()
    if (!/^[A-Z0-9_-]{3,30}$/.test(customerCode) || !name || name.length > 150 || !/^[a-z0-9-]{3,63}$/.test(websiteSlug)) {
      throw new Error('Enter a valid customer code, name, and website slug')
    }
    const result = await getPlatformDb().query<{ id: string }>(
      `INSERT INTO platform_customers (id, customer_code, name, website_slug, status)
       VALUES ($1, $2, $3, $4, 'inactive') RETURNING id`,
      [crypto.randomUUID(), customerCode, name, websiteSlug],
    )
    return { id: result.rows[0].id, status: 'inactive' as const }
  })
