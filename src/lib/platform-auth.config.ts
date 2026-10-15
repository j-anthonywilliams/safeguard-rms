
import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

const connectionString = process.env.PLATFORM_DATABASE_URL

if (!connectionString) {
  throw new Error('PLATFORM_DATABASE_URL is not configured')
}

export const auth = betterAuth({
  database: new Pool({
    connectionString,
  }),

  emailAndPassword: {
    enabled: true,
  },
})
