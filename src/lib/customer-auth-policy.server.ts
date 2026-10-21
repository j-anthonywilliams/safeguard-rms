
import { getCustomerContext } from './customer-context.server'
import { getPlatformDb } from './platform-db.server'

export interface CustomerAuthPolicy {
  googleEnabled: boolean
  emailPasswordEnabled: boolean
  platformSsoEnabled: boolean
  institutionalSsoEnabled: boolean
}

export async function getCustomerAuthPolicy(): Promise<CustomerAuthPolicy> {
  const customer = await getCustomerContext()
  const db = getPlatformDb()

  const result = await db.query<CustomerAuthPolicy>(
    `
      SELECT
        google_enabled AS "googleEnabled",
        email_password_enabled AS "emailPasswordEnabled",
        platform_sso_enabled AS "platformSsoEnabled",
        institutional_sso_enabled AS "institutionalSsoEnabled"
      FROM platform_customer_auth_settings
      WHERE customer_id = $1
    `,
    [customer.id],
  )

  if (result.rows.length !== 1) {
    throw new Error(
      'Customer authentication policy is missing or invalid',
    )
  }

  return result.rows[0]
}
