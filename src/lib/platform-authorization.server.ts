
import { getPlatformDb } from './platform-db.server'
import { requirePlatformSession } from './platform-auth.server'
import { resolveGlobalPlatformIdentity } from './platform-global-identity.server'

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
  const identity = await resolveGlobalPlatformIdentity(userId)
  return identity?.role ?? null
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
 * Customer operational routing authorization.
 * Backend is a global platform role and does not require membership.
 * Support is administrative-only and cannot enter operational customers.
 * Customer roles require active customer membership.
 */
export async function requireCustomerAccess(
  userId: string,
  customerId: string,
): Promise<CustomerMembership> {
  if (!userId || !customerId) {
    throw new Error('Customer access denied')
  }

  const db = getPlatformDb()
  const platformRole = await getPlatformRole(userId)

  if (platformRole === 'support') {
    throw new Error('Support cannot access operational customer environments')
  }

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
      WHERE c.id = $2
        AND c.status = 'active'
        AND (
          $3::text = 'backend'
          OR m.id IS NOT NULL
        )
      LIMIT 1
    `,
    [userId, customerId, platformRole],
  )

  const membership = result.rows[0]

  if (!membership) {
    throw new Error('You are not authorized to access this customer')
  }

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
