
import type { PoolClient } from 'pg'

export interface ReportNumberResult {
  reportNumber: string
  reportYear: number
  sequence: number
}

/**
 * Generates the next original report number.
 *
 * Format: YYIIII
 * Example: 260002
 *
 * Must be called inside an active PostgreSQL transaction.
 * The caller must use the same client to insert the incident.
 */
export async function generateOriginalReportNumber(
  client: PoolClient,
  customerId: string,
  reportYear: number,
): Promise<ReportNumberResult> {
  if (
    !Number.isInteger(reportYear) ||
    reportYear < 2000 ||
    reportYear > 9999
  ) {
    throw new Error('Invalid report year')
  }

  const result = await client.query<{
    last_sequence: number
  }>(
    `
      INSERT INTO customer_report_sequences (
        customer_id,
        report_year,
        last_sequence
      )
      VALUES ($1, $2, 1)
      ON CONFLICT (customer_id, report_year)
      DO UPDATE SET
        last_sequence =
          customer_report_sequences.last_sequence + 1,
        updated_at = NOW()
      WHERE customer_report_sequences.last_sequence < 9999
      RETURNING last_sequence
    `,
    [customerId, reportYear],
  )

  const sequence = result.rows[0]?.last_sequence

  if (!sequence) {
    throw new Error(
      'Annual report number limit reached for this customer',
    )
  }

  const year = String(reportYear).slice(-2)
  const number = String(sequence).padStart(4, '0')

  return {
    reportNumber: `${year}${number}`,
    reportYear,
    sequence,
  }
}

/**
 * Generates the next supplemental report number.
 *
 * Examples:
 * 260001.1
 * 260001.2
 * 260001.3
 *
 * The original incident must be locked by the caller
 * before invoking this function.
 */
export async function generateSupplementalReportNumber(
  client: PoolClient,
  customerId: string,
  originalIncidentId: string,
): Promise<string> {
  const originalResult = await client.query<{
    report_number: string
  }>(
    `
      SELECT report_number
      FROM incidents
      WHERE id = $1
        AND customer_id = $2
        AND parent_incident_id IS NULL
      FOR UPDATE
    `,
    [originalIncidentId, customerId],
  )

  const original = originalResult.rows[0]

  if (!original) {
    throw new Error('Original incident not found')
  }

  const baseNumber = original.report_number

  const supplementResult = await client.query<{
    next_number: string
  }>(
    `
      SELECT
        COALESCE(
          MAX(
            SUBSTRING(
              report_number
              FROM LENGTH($1::text) + 2
            )::numeric
          ),
          0
        ) + 1 AS next_number
      FROM incidents
      WHERE customer_id = $2
        AND report_number ~ (
          '^' || $1 || '[.][0-9]+$'
        )
    `,
    [baseNumber, customerId],
  )

  const nextNumber = supplementResult.rows[0]?.next_number

  if (!nextNumber) {
    throw new Error('Could not generate supplemental number')
  }

  return `${baseNumber}.${nextNumber}`
}
