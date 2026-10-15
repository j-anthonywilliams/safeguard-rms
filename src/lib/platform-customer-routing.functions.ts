
import { createServerFn } from '@tanstack/react-start'

import {
  requirePlatformSession,
} from './platform-auth.server'

import {
  requireCustomerAccess,
} from './platform-authorization.server'

import {
  resolveCustomerRoute,
} from './platform-routing.server'

/**
 * Resolves a customer website only after verifying
 * the currently authenticated platform user's access.
 *
 * The user ID comes from the verified platform session.
 * The customer ID is checked against platform memberships
 * and authorized platform roles.
 */
export const getAuthorizedCustomerRoute = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      customerId: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const session = await requirePlatformSession()

    const membership = await requireCustomerAccess(
      session.user.id,
      data.customerId,
    )

    const route = await resolveCustomerRoute(
      membership.websiteSlug,
    )

    // Ensure the routing destination belongs to
    // the same customer that was authorized.
    if (route.customerId !== membership.customerId) {
      throw new Error(
        'Customer routing configuration mismatch',
      )
    }

    return {
      customerId: route.customerId,
      customerCode: route.customerCode,
      customerName: route.customerName,
      websiteUrl: route.websiteUrl,
      customerRole: membership.customerRole,
      platformRole: membership.platformRole,
    }
  })

  