import { createServerFn } from '@tanstack/react-start'
import { requireGlobalPlatformIdentity } from './platform-global-identity.server'

/** Never infer global authority from a customer-local role or browser state. */
export const getPlatformNavigationRole = createServerFn({ method: 'GET' })
  .handler(async (): Promise<{ role: 'support' | 'backend' | null }> => {
    try {
      const identity = await requireGlobalPlatformIdentity()
      return { role: identity.role }
    } catch {
      return { role: null }
    }
  })
