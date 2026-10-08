import { createServerFn } from '@tanstack/react-start'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db.server'
import type { AccessLevel } from '@/lib/access-control'

export interface SchedulerUser {
  id: string
  email: string
  displayName: string | null
}

export interface SchedulerEntry {
  id: string
  userId: string
  shiftDate: string
  startTime: string
  endTime: string
  title: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface SchedulerPtoRequest {
  id: string
  userId: string
  ptoType: string
  startDate: string
  endDate: string
  notes: string | null
  status: 'Pending' | 'Approved' | 'Denied'
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  createdAt: string
  updatedAt: string
}

async function requireSession() {
  const session = await getSession()

  if (!session?.user) {
    throw new Error('Not authenticated')
  }

  return session
}

async function getAccessLevel(
  userId: string,
): Promise<AccessLevel> {
  const db = getDb()

  const result = await db.query<{ role: AccessLevel }>(
    `
      SELECT role
      FROM app_roles
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  )

  return result.rows[0]?.role ?? 'user'
}

async function requireScheduleEditor(userId: string) {
  const accessLevel = await getAccessLevel(userId)

  if (
    !['supervisor', 'admin', 'backend'].includes(accessLevel)
  ) {
    throw new Error(
      'You do not have permission to edit the schedule',
    )
  }

  return accessLevel
}

export const getSchedulerData = createServerFn({
  method: 'GET',
}).handler(async () => {
  const session = await requireSession()
  const db = getDb()

  const accessLevel = await getAccessLevel(session.user.id)

  const [usersResult, scheduleResult, ptoResult] =
    await Promise.all([
      db.query<SchedulerUser>(
        `
          SELECT
            id,
            email,
            display_name AS "displayName"
          FROM users
          ORDER BY created_at ASC
          LIMIT 500
        `,
      ),

      db.query<SchedulerEntry>(
        `
          SELECT
            id,
            user_id AS "userId",
            shift_date AS "shiftDate",
            start_time AS "startTime",
            end_time AS "endTime",
            title,
            notes,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM schedule_entries
          ORDER BY shift_date ASC, start_time ASC
          LIMIT 1000
        `,
      ),

      db.query<SchedulerPtoRequest>(
        `
          SELECT
            id,
            user_id AS "userId",
            pto_type AS "ptoType",
            start_date AS "startDate",
            end_date AS "endDate",
            notes,
            status,
            reviewed_by AS "reviewedBy",
            reviewed_at AS "reviewedAt",
            review_notes AS "reviewNotes",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM pto_requests
          ORDER BY created_at DESC
          LIMIT 1000
        `,
      ),
    ])

  return {
    accessLevel,
    users: usersResult.rows,
    scheduleEntries: scheduleResult.rows,
    ptoRequests: ptoResult.rows,
  }
})

export const saveScheduleEntry = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      id: string | null
      userId: string
      shiftDate: string
      startTime: string
      endTime: string
      title: string
      notes: string | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const session = await requireSession()

    await requireScheduleEditor(session.user.id)

    const db = getDb()
    const now = new Date().toISOString()

    if (data.id) {
      const result = await db.query<SchedulerEntry>(
        `
          UPDATE schedule_entries
          SET
            user_id = $1,
            shift_date = $2,
            start_time = $3,
            end_time = $4,
            title = $5,
            notes = $6,
            updated_at = $7
          WHERE id = $8
          RETURNING
            id,
            user_id AS "userId",
            shift_date AS "shiftDate",
            start_time AS "startTime",
            end_time AS "endTime",
            title,
            notes,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          data.userId,
          data.shiftDate,
          data.startTime,
          data.endTime,
          data.title,
          data.notes,
          now,
          data.id,
        ],
      )

      if (!result.rows[0]) {
        throw new Error('Schedule entry not found')
      }

      return result.rows[0]
    }

    const result = await db.query<SchedulerEntry>(
      `
        INSERT INTO schedule_entries (
          id,
          user_id,
          shift_date,
          start_time,
          end_time,
          title,
          notes,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
        RETURNING
          id,
          user_id AS "userId",
          shift_date AS "shiftDate",
          start_time AS "startTime",
          end_time AS "endTime",
          title,
          notes,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        crypto.randomUUID(),
        data.userId || session.user.id,
        data.shiftDate,
        data.startTime,
        data.endTime,
        data.title,
        data.notes,
        now,
        now,
      ],
    )

    return result.rows[0]
  })

export const createPtoRequest = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      ptoType: string
      startDate: string
      endDate: string
      notes: string | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const session = await requireSession()
    const db = getDb()
    const now = new Date().toISOString()

    const result = await db.query<SchedulerPtoRequest>(
      `
        INSERT INTO pto_requests (
          id,
          user_id,
          pto_type,
          start_date,
          end_date,
          notes,
          status,
          reviewed_by,
          reviewed_at,
          review_notes,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12
        )
        RETURNING
          id,
          user_id AS "userId",
          pto_type AS "ptoType",
          start_date AS "startDate",
          end_date AS "endDate",
          notes,
          status,
          reviewed_by AS "reviewedBy",
          reviewed_at AS "reviewedAt",
          review_notes AS "reviewNotes",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        crypto.randomUUID(),
        session.user.id,
        data.ptoType,
        data.startDate,
        data.endDate,
        data.notes,
        'Pending',
        null,
        null,
        null,
        now,
        now,
      ],
    )

    return result.rows[0]
  })

export const reviewPtoRequest = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      requestId: string
      decision: 'Approved' | 'Denied'
      reviewNotes?: string | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const session = await requireSession()

    await requireScheduleEditor(session.user.id)

    const db = getDb()
    const now = new Date().toISOString()

    const result = await db.query<SchedulerPtoRequest>(
      `
        UPDATE pto_requests
        SET
          status = $1,
          reviewed_by = $2,
          reviewed_at = $3,
          review_notes = $4,
          updated_at = $5
        WHERE id = $6
        RETURNING
          id,
          user_id AS "userId",
          pto_type AS "ptoType",
          start_date AS "startDate",
          end_date AS "endDate",
          notes,
          status,
          reviewed_by AS "reviewedBy",
          reviewed_at AS "reviewedAt",
          review_notes AS "reviewNotes",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        data.decision,
        session.user.id,
        now,
        data.reviewNotes ?? null,
        now,
        data.requestId,
      ],
    )

    if (!result.rows[0]) {
      throw new Error('Time-off request not found')
    }

    return result.rows[0]
  })