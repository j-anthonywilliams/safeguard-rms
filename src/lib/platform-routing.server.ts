
import { getPlatformDb } from './platform-db.server'

export interface PlatformCustomerRoute {
  customerId: string
  customerCode: string
  customerName: string
  websiteSlug: string
  websiteUrl: string
}

export async function resolveCustomerRoute(
  websiteSlug: string,
): Promise<PlatformCustomerRoute> {
  const slug = websiteSlug.trim().toLowerCase()

  if (!/^[a-z0-9-]{1,64}$/.test(slug)) {
    throw new Error('Invalid customer website identifier')
  }

  const db = getPlatformDb()

  const result = await db.query<PlatformCustomerRoute>(
    `
      SELECT
        c.id AS "customerId",
        c.customer_code AS "customerCode",
        c.name AS "customerName",
        c.website_slug AS "websiteSlug",
        d.domain AS "websiteUrl"
      FROM platform_customers c
      JOIN platform_customer_domains d
        ON d.customer_id = c.id
      WHERE c.website_slug = $1
        AND c.status = 'active'
        AND d.is_active = TRUE
        AND d.is_primary = TRUE
      LIMIT 1
    `,
    [slug],
  )

  const customer = result.rows[0]

  if (!customer) {
    throw new Error(
      'Customer website not found or unavailable',
    )
  }

  // Validate the registered destination before returning it.
  const url = new URL(customer.websiteUrl)

  const isLocalDevelopment =
    process.env.NODE_ENV === 'development' &&
    ['localhost', '127.0.0.1'].includes(url.hostname)

  if (
    url.protocol !== 'https:' &&
    !(isLocalDevelopment && url.protocol === 'http:')
  ) {
    throw new Error('Invalid customer website configuration')
  }

  if (url.username || url.password) {
    throw new Error('Invalid customer website credentials')
  }

  return {
    ...customer,
    websiteUrl: url.origin,
  }
}
