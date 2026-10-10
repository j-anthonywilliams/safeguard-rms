import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/test')({
  server: {
    handlers: {
      GET: () => Response.json({
        status: 'OK',
        message: 'TanStack Start server is working',
      }),
    },
  },
})
