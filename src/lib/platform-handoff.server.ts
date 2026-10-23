
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  verifyCustomerServiceCredential,
} from './platform-service-auth.server'
import { getPlatformDb } from './platform-db.server'
import { requirePlatformSession } from './platform-auth.server'
import { requireCustomerAccess } from './platform-authorization.server'
import { resolveCustomerRoute } from './platform-routing.server'

export interface PlatformHandoffResult {
  code: string
  customerId: string
  websiteUrl: string
  expiresAt: string
}

/**
 * Creates a short-lived, single-use authentication
 * handoff code for an authorized customer.
 *
 * The code must be redeemed by a trusted customer
 * authentication service before a customer session
 * can be established.
 */
export async function createPlatformHandoff(
  customerId: string,
): Promise<PlatformHandoffResult> {
  const session = await requirePlatformSession()

  const membership = await requireCustomerAccess(
    session.user.id,
    customerId,
  )

  const route = await resolveCustomerRoute(
    membership.websiteSlug,
  )

  if (route.customerId !== customerId) {
    throw new Error('Customer routing mismatch')
  }

  const db = getPlatformDb()

  const mappingResult = await db.query<{
    customer_user_id: string
  }>(
    `
      SELECT customer_user_id
      FROM platform_customer_user_mappings
      WHERE platform_user_id = $1
        AND customer_id = $2
        AND status = 'active'
      LIMIT 1
    `,
    [session.user.id, customerId],
  )

  if (!mappingResult.rows[0]) {
    throw new Error(
      'No verified customer account mapping exists',
    )
  }

  const code = randomBytes(32).toString('base64url')

  const codeHash = createHash('sha256')
    .update(code)
    .digest('hex')

  const expiresAt = new Date(
    Date.now() + 60_000,
  ).toISOString()

  await db.query(
    `
      INSERT INTO platform_auth_handoffs (
        id,
        code_hash,
        user_id,
        customer_id,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      randomUUID(),
      codeHash,
      session.user.id,
      customerId,
      expiresAt,
    ],
  )

  return {
    code,
    customerId,
    websiteUrl: route.websiteUrl,
    expiresAt,
  }
}


export interface RedeemedPlatformHandoff {
  platformUserId: string
  customerId: string
  customerUserId: string
}

/**
 * Redeems a short-lived platform handoff code.
 *
 * IMPORTANT:
 * This function must only be called by a trusted
 * customer authentication service.
 *
 * Do not expose it directly through a public
 * TanStack server function or API endpoint.
 */
export async function redeemPlatformHandoff(
  code: string,
  expectedCustomerId: string,
): Promise<RedeemedPlatformHandoff> {
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(code) ||
    !expectedCustomerId
  ) {
    throw new Error('Invalid authentication handoff')
  }

  const codeHash = createHash('sha256')
    .update(code)
    .digest('hex')

  const db = getPlatformDb()
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    const result = await client.query<{
      platform_user_id: string
      customer_id: string
      customer_user_id: string
    }>(
      `
        UPDATE platform_auth_handoffs h
        SET consumed_at = NOW()
        FROM platform_customers c,
             platform_customer_user_mappings m,
             "user" u
        WHERE h.code_hash = $1
          AND h.customer_id = $2
          AND h.consumed_at IS NULL
          AND h.expires_at > NOW()
          AND c.id = h.customer_id
          AND c.status = 'active'
          AND u.id = h.user_id
          AND m.platform_user_id = h.user_id
          AND m.customer_id = h.customer_id
          AND m.status = 'active'
          AND (
            EXISTS (
              SELECT 1
              FROM platform_customer_memberships cm
              WHERE cm.user_id = h.user_id
                AND cm.customer_id = h.customer_id
                AND cm.status = 'active'
            )
            OR EXISTS (
              SELECT 1
              FROM platform_user_roles pr
              WHERE pr.user_id = h.user_id
                AND pr.platform_role = 'backend'
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM platform_user_roles pr
            WHERE pr.user_id = h.user_id
              AND pr.platform_role = 'support'
          )
        RETURNING
          h.user_id AS platform_user_id,
          h.customer_id,
          m.customer_user_id
      `,
      [codeHash, expectedCustomerId],
    )

    const redeemed = result.rows[0]

    if (!redeemed) {
      throw new Error(
        'Authentication handoff expired, invalid, or already used',
      )
    }

    await client.query('COMMIT')

    return {
      platformUserId: redeemed.platform_user_id,
      customerId: redeemed.customer_id,
      customerUserId: redeemed.customer_user_id,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Redeems a platform handoff after authenticating
 * the requesting customer service.
 *
 * The customer ID must be derived from trusted
 * server configuration, not browser input.
 *
 * This function must only be invoked through
 * a server-to-server authentication boundary.
 */
export async function redeemTrustedPlatformHandoff(
  code: string,
  customerId: string,
  serviceCredential: string,
): Promise<RedeemedPlatformHandoff> {
  const verifiedService =
    await verifyCustomerServiceCredential(
      serviceCredential,
      customerId,
    )

  if (verifiedService.customerId !== customerId) {
    throw new Error(
      'Customer service identity mismatch',
    )
  }

  const redeemed = await redeemPlatformHandoff(
    code,
    verifiedService.customerId,
  )

  if (redeemed.customerId !== verifiedService.customerId) {
    throw new Error(
      'Authentication handoff customer mismatch',
    )
  }

  return redeemed
}
