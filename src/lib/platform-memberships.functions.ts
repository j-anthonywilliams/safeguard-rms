
import { createServerFn } from '@tanstack/react-start'

import {
  getAuthenticatedCustomerMemberships,
} from './platform-authorization.server'

export const getMyPlatformMemberships = createServerFn({
  method: 'GET',
}).handler(async () => {
  return getAuthenticatedCustomerMemberships()
})
