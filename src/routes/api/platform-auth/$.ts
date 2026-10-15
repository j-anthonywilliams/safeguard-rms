import { createFileRoute } from '@tanstack/react-router'
import { getPlatformAuth } from '@/lib/platform-auth.server'

export const Route = createFileRoute('/api/platform-auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) =>
        getPlatformAuth().handler(request),

      POST: async ({ request }) =>
        getPlatformAuth().handler(request),
    },
  },
})