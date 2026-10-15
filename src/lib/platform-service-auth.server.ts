
import {
  createHash,
  timingSafeEqual,
} from 'node:crypto'

import { getPlatformDb } from './platform-db.server'

export interface VerifiedCustomerService {
  customerId: string
  customerCode: string
  credentialId: string
}

/**
 * Validates a customer server's service credential.
 *
 * This function must remain server-only.
 * Never expose it directly through a browser-callable
 * server function.
 */
export async function verifyCustomerServiceCredential(
  credential: string,
  expectedCustomerId: string,
): Promise<VerifiedCustomerService> {
  if (
    !credential ||
    !expectedCustomerId ||
    credential.length > 1024
  ) {
    throw new Error('Invalid customer service credentials')
  }

  const credentialHash = createHash('sha256')
    .update(credential)
    .digest('hex')

  const db = getPlatformDb()

  const result = await db.query<{
    credential_id: string
    customer_id: string
    customer_code: string
    credential_hash: string
  }>(
    `
      SELECT
        sc.id AS credential_id,
        sc.customer_id,
        c.customer_code,
        sc.credential_hash
      FROM platform_customer_service_credentials sc
      JOIN platform_customers c
        ON c.id = sc.customer_id
      WHERE sc.customer_id = $1
        AND sc.status = 'active'
        AND c.status = 'active'
        AND (
          sc.expires_at IS NULL
          OR sc.expires_at > NOW()
        )
    `,
    [expectedCustomerId],
  )

  let matchedCredential:
    | (typeof result.rows)[number]
    | undefined

  for (const row of result.rows) {
    const storedHash = Buffer.from(
      row.credential_hash,
      'hex',
    )

    const suppliedHash = Buffer.from(
      credentialHash,
      'hex',
    )

    if (
      storedHash.length === suppliedHash.length &&
      timingSafeEqual(storedHash, suppliedHash)
    ) {
      matchedCredential = row
      break
    }
  }

  if (!matchedCredential) {
    throw new Error('Invalid customer service credentials')
  }

  await db.query(
    `
      UPDATE platform_customer_service_credentials
      SET last_used_at = NOW()
      WHERE id = $1
    `,
    [matchedCredential.credential_id],
  )

  return {
    customerId: matchedCredential.customer_id,
    customerCode: matchedCredential.customer_code,
    credentialId: matchedCredential.credential_id,
  }
}
