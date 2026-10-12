
import { getDb } from './db.server'

export interface CustomerContext {
  id: string
  customerCode: string
  name: string
}

export async function getCustomerContext(): Promise<CustomerContext> {
  const db = getDb()

  const result = await db.query<CustomerContext>(
    `
      SELECT
        id,
        customer_code AS "customerCode",
        name
      FROM customer_settings
      WHERE status = 'active'
      LIMIT 2
    `,
  )

  if (result.rows.length !== 1) {
    throw new Error(
      'Customer configuration error: exactly one active customer is required',
    )
  }

  return result.rows[0]
}
