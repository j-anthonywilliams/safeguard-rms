
import { getPlatformDb } from './platform-db.server'
import { requirePlatformSession } from './platform-auth.server'

export type PlatformRole = 'support' | 'backend'

export type CustomerRole =
  | 'user'
  | 'investigator'
  | 'supervisor'
  | 'office_staff'
  | 'admin'

export interface CustomerMembership {
  customerId: string
  customerCode: string
  customerName: string
  customerRole: CustomerRole | null
  platformRole: PlatformRole | null
  websiteSlug: string
}

export async function getPlatformRole(
  userId: string,
): Promise<PlatformRole | null> {
  const db = getPlatformDb()

  const result = await db.query<{
    platform_role: PlatformRole
  }>(
    `
      SELECT platform_role
      FROM platform_user_roles
      WHERE user_id = $1
      ORDER BY
        CASE platform_role
          WHEN 'backend' THEN 1
          WHEN 'support' THEN 2
        END
      LIMIT 1
    `,
    [userId],
  )

  return result.rows[0]?.platform_role ?? null
}

/**
 * Customer directory visibility.
 *
 * Backend and Support may see all active customers.
 * Other users see only customers with active membership.
 *
 * Directory visibility does not grant operational access.
 */
export async function getCustomerMemberships(
  userId: string,
): Promise<CustomerMembership[]> {
  const db = getPlatformDb()
  const platformRole = await getPlatformRole(userId)

  const result = await db.query<{
    customerId: string
    customerCode: string
    customerName: string
    customerRole: CustomerRole | null
    websiteSlug: string
  }>(
    `
      SELECT
        c.id AS "customerId",
        c.customer_code AS "customerCode",
        c.name AS "customerName",
        m.customer_role AS "customerRole",
        c.website_slug AS "websiteSlug"
      FROM platform_customers c
      LEFT JOIN platform_customer_memberships m
        ON m.customer_id = c.id
       AND m.user_id = $1
       AND m.status = 'active'
      WHERE c.status = 'active'
        AND (
          m.id IS NOT NULL
          OR $2::text IN ('support', 'backend')
        )
      ORDER BY c.name
    `,
    [userId, platformRole],
  )

  return result.rows.map(row => ({
    ...row,
    platformRole,
  }))
}

/**
 * Operational customer access.
 *
 * Requires an explicit active membership.
 * Platform roles alone never grant operational access.
 */
export async function requireCustomerAccess(
  userId: string,
  customerId: string,
): Promise<CustomerMembership> {
  if (!userId || !customerId) {
    throw new Error('Customer access denied')
  }

  const db = getPlatformDb()

  const result = await db.query<{
    customerId: string
    customerCode: string
    customerName: string
    customerRole: CustomerRole
    websiteSlug: string
  }>(
    `
      SELECT
        c.id AS "customerId",
        c.customer_code AS "customerCode",
        c.name AS "customerName",
        m.customer_role AS "customerRole",
        c.website_slug AS "websiteSlug"
      FROM platform_customer_memberships m
      JOIN platform_customers c
        ON c.id = m.customer_id
      WHERE m.user_id = $1
        AND m.customer_id = $2
        AND m.status = 'active'
        AND c.status = 'active'
      LIMIT 1
    `,
    [userId, customerId],
  )

  const membership = result.rows[0]

  if (!membership) {
    throw new Error(
      'You are not authorized to access this customer',
    )
  }

  const platformRole = await getPlatformRole(userId)

  return {
    ...membership,
    platformRole,
  }
}

/**
 * Returns customers visible to the authenticated
 * platform user.
 *
 * This is directory visibility, not operational access.
 */
export async function getAuthenticatedCustomerMemberships():
  Promise<CustomerMembership[]> {
  const session = await requirePlatformSession()

  return getCustomerMemberships(session.user.id)
}

/**
 * Requires authenticated, active customer membership.
 */
export async function requireAuthenticatedCustomerAccess(
  customerId: string,
): Promise<CustomerMembership> {
  const session = await requirePlatformSession()

  return requireCustomerAccess(
    session.user.id,
    customerId,
  )
}
