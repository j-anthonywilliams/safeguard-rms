
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

export async function requireCustomerAccess(
  userId: string,
  customerId: string,
): Promise<CustomerMembership> {
  const memberships = await getCustomerMemberships(userId)

  const membership = memberships.find(
    item => item.customerId === customerId,
  )

  if (!membership) {
    throw new Error(
      'You are not authorized to access this customer',
    )
  }

  return membership
}


/**
 * Returns the customer memberships associated with
 * the currently authenticated platform user.
 *
 * The user ID is obtained from the verified
 * Better Auth session, never from browser input.
 */
export async function getAuthenticatedCustomerMemberships():
  Promise<CustomerMembership[]> {
  const session = await requirePlatformSession()

  return getCustomerMemberships(session.user.id)
}

/**
 * Verifies that the currently authenticated platform
 * user has access to the requested customer.
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
