import { createServerFn } from '@tanstack/react-start'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db.server'

export const createProfileUpdate = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      displayName: string
      phone: string | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const session = await getSession()

    if (!session?.user) {
      throw new Error('Not authenticated')
    }

    const db = getDb()
    const now = new Date().toISOString()

    const result = await db.query<{
      id: string
      email: string
      displayName: string | null
      phone: string | null
    }>(
      `
        UPDATE users
        SET
          display_name = $1,
          phone = $2,
          updated_at = $3
        WHERE id = $4
        RETURNING
          id,
          email,
          display_name AS "displayName",
          phone
      `,
      [
        data.displayName.trim(),
        data.phone?.trim() || null,
        now,
        session.user.id,
      ],
    )

    if (!result.rows[0]) {
      throw new Error('User profile not found')
    }

    return result.rows[0]
  })