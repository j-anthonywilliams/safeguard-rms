
import { Resend } from 'resend'
import { getDb } from './db.server'

interface RejectionPayload {
  reportNumber: string
  reviewer: string
  feedback: string
  reviewedAt: string
}

interface PendingNotification {
  id: string
  recipient_email: string
  payload: RejectionPayload
  attempts: number
  next_attempt_at: Date
}

export async function processPendingEmails(): Promise<{
  sent: number
  failed: number
}> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !fromEmail) {
    throw new Error('Resend email configuration is missing')
  }

  const resend = new Resend(apiKey)
  const db = getDb()

  let sent = 0
  let failed = 0

  // Atomically claim pending notifications.
  // Also reclaim interrupted jobs after their lease expires.
  const result = await db.query<PendingNotification>(
    `
      WITH claimed AS (
        SELECT id
        FROM notification_outbox
        WHERE notification_type = 'incident_rejected'
          AND status IN (
            'pending',
            'failed',
            'processing'
          )
          AND next_attempt_at <= NOW()
          AND attempts < 5
        ORDER BY created_at ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      )
      UPDATE notification_outbox n
      SET
        status = 'processing',
        next_attempt_at =
          NOW() + INTERVAL '5 minutes',
        attempts = n.attempts + 1
      FROM claimed
      WHERE n.id = claimed.id
      RETURNING
        n.id,
        n.recipient_email,
        n.payload,
        n.attempts,
        n.next_attempt_at
    `,
  )

  for (const notification of result.rows) {
    const payload = notification.payload

    try {
      // Submit the email to Resend.
      // The notification ID provides a stable
      // idempotency key for retry attempts.
      const response = await resend.emails.send(
        {
          from: fromEmail,
          to: notification.recipient_email,
          subject:
            `SafeGuard-RMS: Report ${payload.reportNumber} Rejected`,
          text: [
            `Report ${payload.reportNumber} requires correction.`,
            '',
            `Reviewed by: ${payload.reviewer}`,
            `Reviewed at: ${payload.reviewedAt}`,
            '',
            'Reviewer feedback:',
            payload.feedback,
            '',
            'Sign in to SafeGuard-RMS to review and correct the report.',
          ].join('\n'),
        },
        {
          idempotencyKey:
            `incident-rejection/${notification.id}`,
        },
      )

      if (response.error) {
        throw new Error(response.error.message)
      }

      if (!response.data?.id) {
        throw new Error(
          'Resend did not confirm email acceptance',
        )
      }

      // Mark the notification as sent only if
      // this worker still owns the processing lease.
      const updateResult = await db.query(
        `
            UPDATE notification_outbox
            SET
            status = 'sent',
            sent_at = NOW(),
            last_error = NULL
            WHERE id = $1
            AND status = 'processing'
            AND attempts = $2
        `,
        [
            notification.id,
            notification.attempts,
        ],
    )

      if (updateResult.rowCount === 1) {
        sent++
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown email delivery error'

      // Preserve the failure for retry.
      // Attempts were already incremented
      // when the notification was claimed.
      const updateResult = await db.query(
        `
            UPDATE notification_outbox
            SET
            status = 'failed',
            next_attempt_at =
                NOW() + INTERVAL '5 minutes',
            last_error = $2
            WHERE id = $1
            AND status = 'processing'
            AND attempts = $3
        `,
        [
            notification.id,
            errorMessage,
            notification.attempts,
        ],
        )

      if (updateResult.rowCount === 1) {
        failed++
      }
    }
  }

  return {
    sent,
    failed,
  }
}
