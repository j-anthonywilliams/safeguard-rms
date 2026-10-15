import { createServerFn } from '@tanstack/react-start'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db.server'
import type { AccessLevel } from '@/lib/access-control'
import {
  requireActiveUser,
  requireRole,
} from '@/lib/authorization.server'
import { getCustomerContext } from '@/lib/customer-context.server'
import {
  generateOriginalReportNumber,
  generateSupplementalReportNumber,
} from '@/lib/report-numbering.server'

export interface DashboardIncident {
  id: string
  userId: string
  reportNumber: string
  incidentDate: string
  location: string
  city: string
  state: string
  zipCode: string
  subjectName: string
  subjectPhone: string | null
  subjectDob: string | null
  violentFlag: number
  banBarFlag: number
  incidentCodes: string
  disposition: string
  narrative: string
  approvalStatus: 'Pending' | 'Approved' | 'Rejected'
  approvedBy: string | null
  approvedAt: string | null
  reviewFeedback: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  caseFileId: string | null
  parentIncidentId: string | null
  reportType: string
}

export interface DashboardCaseFile {
  id: string
  userId: string
  caseNumber: string
  title: string
  status: string
  leadOfficer: string | null
  createdAt: string
  updatedAt: string
}

export interface DashboardEquipment {
  id: string
  userId: string
  name: string
  serialNumber: string
  status: string
  assignedTo: string | null
  updatedAt: string
}

export interface DashboardEvidence {
  id: string
  userId: string
  itemNumber: string
  description: string
  location: string
  status: string
  incidentId: string | null
  createdAt: string
}

export interface DashboardCustodyEvent {
  id: string
  userId: string
  evidenceId: string
  action: string
  actor: string
  note: string | null
  eventAt: string
}

export interface DashboardAttendanceLog {
  id: string
  userId: string
  eventType: string
  eventAt: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
}

export interface DashboardDirectoryUser {
  id: string
  email: string
  displayName: string | null
}

export const getDashboardData = createServerFn({
  method: 'GET',
}).handler(async () => {
  const session = await getSession()

  if (!session?.user) {
    throw new Error('Not authenticated')
  }

  const userId = session.user.id
  const db = getDb()

  const roleResult = await db.query<{ role: AccessLevel }>(
    `
      SELECT role
      FROM app_roles
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  )

  const accessLevel = roleResult.rows[0]?.role ?? 'user'

  const canViewAllIncidents = [
    'supervisor',
    'admin',
    'backend',
  ].includes(accessLevel)

  const incidentQuery = canViewAllIncidents
    ? db.query<DashboardIncident>(`
        SELECT
          id,
          user_id AS "userId",
          report_number AS "reportNumber",
          incident_date AS "incidentDate",
          location,
          city,
          state,
          zip_code AS "zipCode",
          subject_name AS "subjectName",
          subject_phone AS "subjectPhone",
          subject_dob AS "subjectDob",
          violent_flag AS "violentFlag",
          ban_bar_flag AS "banBarFlag",
          incident_codes AS "incidentCodes",
          disposition,
          narrative,
          approval_status AS "approvalStatus",
          approved_by AS "approvedBy",
          approved_at AS "approvedAt",
          review_feedback AS "reviewFeedback",
          reviewed_by AS "reviewedBy",
          reviewed_at AS "reviewedAt",
          created_at AS "createdAt",
          case_file_id AS "caseFileId",
          parent_incident_id AS "parentIncidentId",
          report_type AS "reportType"
        FROM incidents
        ORDER BY created_at DESC
        LIMIT 100
      `)
    : db.query<DashboardIncident>(
        `
          SELECT
            id,
            user_id AS "userId",
            report_number AS "reportNumber",
            incident_date AS "incidentDate",
            location,
            city,
            state,
            zip_code AS "zipCode",
            subject_name AS "subjectName",
            subject_phone AS "subjectPhone",
            subject_dob AS "subjectDob",
            violent_flag AS "violentFlag",
            ban_bar_flag AS "banBarFlag",
            incident_codes AS "incidentCodes",
            disposition,
            narrative,
            approval_status AS "approvalStatus",
            approved_by AS "approvedBy",
            approved_at AS "approvedAt",
            review_feedback AS "reviewFeedback",
            reviewed_by AS "reviewedBy",
            reviewed_at AS "reviewedAt",
            created_at AS "createdAt",
            case_file_id AS "caseFileId",
            parent_incident_id AS "parentIncidentId",
            report_type AS "reportType"
          FROM incidents
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 100
        `,
        [userId],
      )

  const [
    incidentsResult,
    caseFilesResult,
    equipmentResult,
    evidenceResult,
    custodyResult,
    attendanceResult,
    usersResult,
  ] = await Promise.all([
    incidentQuery,

    db.query<DashboardCaseFile>(
      `
        SELECT
          id,
          user_id AS "userId",
          case_number AS "caseNumber",
          title,
          status,
          lead_officer AS "leadOfficer",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM case_files
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT 100
      `,
      [userId],
    ),

    db.query<DashboardEquipment>(
      `
        SELECT
          id,
          user_id AS "userId",
          name,
          serial_number AS "serialNumber",
          status,
          assigned_to AS "assignedTo",
          updated_at AS "updatedAt"
        FROM equipment
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT 8
      `,
      [userId],
    ),

    db.query<DashboardEvidence>(
      `
        SELECT
          id,
          user_id AS "userId",
          item_number AS "itemNumber",
          description,
          location,
          status,
          incident_id AS "incidentId",
          created_at AS "createdAt"
        FROM evidence
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 8
      `,
      [userId],
    ),

    db.query<DashboardCustodyEvent>(
      `
        SELECT
          id,
          user_id AS "userId",
          evidence_id AS "evidenceId",
          action,
          actor,
          note,
          event_at AS "eventAt"
        FROM custody_events
        WHERE user_id = $1
        ORDER BY event_at DESC
        LIMIT 10
      `,
      [userId],
    ),

    db.query<DashboardAttendanceLog>(
      `
        SELECT
          id,
          user_id AS "userId",
          event_type AS "eventType",
          event_at AS "eventAt",
          latitude,
          longitude,
          accuracy
        FROM attendance_logs
        WHERE user_id = $1
        ORDER BY event_at DESC
        LIMIT 30
      `,
      [userId],
    ),

    db.query<DashboardDirectoryUser>(`
      SELECT
        id,
        email,
        display_name AS "displayName"
      FROM users
      ORDER BY created_at ASC
      LIMIT 100
    `),
  ])

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.name,
    },
    accessLevel,
    incidents: incidentsResult.rows,
    caseFiles: caseFilesResult.rows,
    equipment: equipmentResult.rows,
    evidence: evidenceResult.rows,
    events: custodyResult.rows,
    attendanceLogs: attendanceResult.rows,
    directoryUsers: usersResult.rows,
  }
})


export const createAttendanceLog = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      eventType: 'clock_in' | 'clock_out'
      latitude: number | null
      longitude: number | null
      accuracy: number | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const authorizedUser = await requireActiveUser()
    const customer = await getCustomerContext()

    const db = getDb()
    const now = new Date().toISOString()

    if (
      data.eventType !== 'clock_in' &&
      data.eventType !== 'clock_out'
    ) {
      throw new Error('Invalid attendance event type')
    }

    const result = await db.query<DashboardAttendanceLog>(
      `
        INSERT INTO attendance_logs (
          id,
          user_id,
          customer_id,
          event_type,
          event_at,
          latitude,
          longitude,
          accuracy
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          user_id AS "userId",
          event_type AS "eventType",
          event_at AS "eventAt",
          latitude,
          longitude,
          accuracy
      `,
      [
        crypto.randomUUID(),
        authorizedUser.id,
        customer.id,
        data.eventType,
        now,
        data.latitude,
        data.longitude,
        data.accuracy,
      ],
    )

    if (!result.rows[0]) {
      throw new Error('Attendance record could not be created')
    }

    return result.rows[0]
  })


  export const approveIncident = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      incidentId: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const authorizedUser = await requireRole([
      'supervisor',
      'admin',
      'backend',
    ])

    const session = await getSession()

    if (!session?.user || session.user.id !== authorizedUser.id) {
      throw new Error('Authentication required')
    }

    const db = getDb()

    const approvedAt = new Date().toISOString()
    const approvedBy =
      session.user.name ||
      session.user.email ||
      'Supervisor'

    const result = await db.query<DashboardIncident>(
      `
        UPDATE incidents
        SET
          approval_status = 'Approved',
          approved_by = $1,
          approved_at = $2
        WHERE id = $3
        RETURNING
          id,
          user_id AS "userId",
          report_number AS "reportNumber",
          incident_date AS "incidentDate",
          location,
          city,
          state,
          zip_code AS "zipCode",
          subject_name AS "subjectName",
          subject_phone AS "subjectPhone",
          subject_dob AS "subjectDob",
          violent_flag AS "violentFlag",
          ban_bar_flag AS "banBarFlag",
          incident_codes AS "incidentCodes",
          disposition,
          narrative,
          approval_status AS "approvalStatus",
          approved_by AS "approvedBy",
          approved_at AS "approvedAt",
          review_feedback AS "reviewFeedback",
          reviewed_by AS "reviewedBy",
          reviewed_at AS "reviewedAt",
          created_at AS "createdAt",
          case_file_id AS "caseFileId",
          parent_incident_id AS "parentIncidentId",
          report_type AS "reportType"
        `,
      [
        approvedBy,
        approvedAt,
        data.incidentId,
      ],
    )

    if (!result.rows[0]) {
      throw new Error('Incident not found')
    }

    return result.rows[0]
  })

export const reviewIncident = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      incidentId: string
      decision: 'Approved' | 'Rejected'
      feedback: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const authorizedUser = await requireRole([
      'supervisor',
      'admin',
      'backend',
    ])

    const session = await getSession()

    if (!session?.user || session.user.id !== authorizedUser.id) {
      throw new Error('Authentication required')
    }

    if (
      data.decision === 'Rejected' &&
      !data.feedback.trim()
    ) {
      throw new Error('Feedback is required')
    }

    const db = getDb()

    const reviewedAt = new Date().toISOString()
    const reviewer =
      session.user.name ||
      session.user.email ||
      'Supervisor'

    const result = await db.query<DashboardIncident>(
      `
        UPDATE incidents
        SET
          approval_status = $1,
          review_feedback = $2,
          reviewed_by = $3,
          reviewed_at = $4,
          approved_by =
            CASE
              WHEN $1 = 'Approved' THEN $3
              ELSE NULL
            END,
          approved_at =
            CASE
              WHEN $1 = 'Approved' THEN $4
              ELSE NULL
            END
        WHERE id = $5
        RETURNING
          id,
          user_id AS "userId",
          report_number AS "reportNumber",
          incident_date AS "incidentDate",
          location,
          city,
          state,
          zip_code AS "zipCode",
          subject_name AS "subjectName",
          subject_phone AS "subjectPhone",
          subject_dob AS "subjectDob",
          violent_flag AS "violentFlag",
          ban_bar_flag AS "banBarFlag",
          incident_codes AS "incidentCodes",
          disposition,
          narrative,
          approval_status AS "approvalStatus",
          approved_by AS "approvedBy",
          approved_at AS "approvedAt",
          review_feedback AS "reviewFeedback",
          reviewed_by AS "reviewedBy",
          reviewed_at AS "reviewedAt",
          created_at AS "createdAt",
          case_file_id AS "caseFileId",
          parent_incident_id AS "parentIncidentId",
          report_type AS "reportType"
        `,
      [
        data.decision,
        data.feedback.trim() || null,
        reviewer,
        reviewedAt,
        data.incidentId,
      ],
    )

    if (!result.rows[0]) {
      throw new Error('Incident not found')
    }

    return result.rows[0]
  })

export const getPanelEvidence = createServerFn({
  method: 'GET',
}).handler(async () => {
  const authorizedUser = await requireActiveUser()

  const db = getDb()

  const result = await db.query<DashboardEvidence>(
    `
      SELECT
        id,
        user_id AS "userId",
        item_number AS "itemNumber",
        description,
        location,
        status,
        incident_id AS "incidentId",
        created_at AS "createdAt"
      FROM evidence
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [authorizedUser.id],
  )

  return result.rows
})


export const createCaseFile = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      caseNumber: string
      title: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const authorizedUser = await requireRole([
      'user',
      'supervisor',
      'admin',
      'backend',
    ])

    const customer = await getCustomerContext()
    const db = getDb()
    const now = new Date().toISOString()

    const caseNumber = data.caseNumber.trim()
    const title = data.title.trim()

    if (!caseNumber || !title) {
      throw new Error('Case number and title are required')
    }

    const result = await db.query<DashboardCaseFile>(
      `
        INSERT INTO case_files (
          id,
          user_id,
          customer_id,
          case_number,
          title,
          status,
          lead_officer,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
        RETURNING
          id,
          user_id AS "userId",
          case_number AS "caseNumber",
          title,
          status,
          lead_officer AS "leadOfficer",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        crypto.randomUUID(),
        authorizedUser.id,
        customer.id,
        caseNumber,
        title,
        'Open',
        authorizedUser.id,
        now,
        now,
      ],
    )

    if (!result.rows[0]) {
      throw new Error('Case file could not be created')
    }

        return result.rows[0]
      })


export const createEquipment = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      name: string
      serialNumber: string
      assignedTo: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const authorizedUser = await requireRole([
      'user',
      'supervisor',
      'admin',
      'backend',
    ])

    const customer = await getCustomerContext()
    const db = getDb()
    const now = new Date().toISOString()

    const name = data.name.trim()
    const serialNumber = data.serialNumber.trim()

    if (!name || !serialNumber) {
      throw new Error(
        'Equipment name and serial number are required',
      )
    }

    const result = await db.query<DashboardEquipment>(
      `
        INSERT INTO equipment (
          id,
          user_id,
          customer_id,
          name,
          serial_number,
          status,
          assigned_to,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
        RETURNING
          id,
          user_id AS "userId",
          name,
          serial_number AS "serialNumber",
          status,
          assigned_to AS "assignedTo",
          updated_at AS "updatedAt"
      `,
      [
        crypto.randomUUID(),
        authorizedUser.id,
        customer.id,
        name,
        serialNumber,
        'Available',
        data.assignedTo || authorizedUser.id,
        now,
      ],
    )

    if (!result.rows[0]) {
      throw new Error('Equipment could not be created')
    }

    return result.rows[0]
  })


export const createEvidence = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      itemNumber: string
      description: string
      location: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const authorizedUser = await requireRole([
      'user',
      'supervisor',
      'admin',
      'backend',
    ])

    const session = await getSession()

    if (!session?.user || session.user.id !== authorizedUser.id) {
      throw new Error('Authentication required')
    }

    const customer = await getCustomerContext()
    const db = getDb()
    const now = new Date().toISOString()

    const itemNumber = data.itemNumber.trim()
    const description = data.description.trim()
    const location = data.location.trim()

    if (!itemNumber || !description || !location) {
      throw new Error(
        'Item number, description, and location are required',
      )
    }

    const client = await db.connect()

    try {
      await client.query('BEGIN')

      const evidenceResult = await client.query<DashboardEvidence>(
        `
          INSERT INTO evidence (
            id,
            user_id,
            customer_id,
            item_number,
            description,
            location,
            status,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING
            id,
            user_id AS "userId",
            item_number AS "itemNumber",
            description,
            location,
            status,
            incident_id AS "incidentId",
            created_at AS "createdAt"
        `,
        [
          crypto.randomUUID(),
          authorizedUser.id,
          customer.id,
          itemNumber,
          description,
          location,
          'In custody',
          now,
        ],
      )

      const evidence = evidenceResult.rows[0]

      if (!evidence) {
        throw new Error('Evidence record could not be created')
      }

      await client.query(
        `
          INSERT INTO custody_events (
            id,
            user_id,
            evidence_id,
            action,
            actor,
            note,
            event_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          crypto.randomUUID(),
          authorizedUser.id,
          evidence.id,
          'Item received',
          session.user.name ||
            session.user.email ||
            'Current officer',
          'Initial intake',
          now,
        ],
      )

      await client.query('COMMIT')

      return evidence
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })


export const updateEvidenceIncident = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      evidenceId: string
      incidentId: string | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const authorizedUser = await requireRole([
      'user',
      'supervisor',
      'admin',
      'backend',
    ])

    const db = getDb()

    const result = await db.query<DashboardEvidence>(
      `
        UPDATE evidence
        SET incident_id = $1
        WHERE id = $2
          AND user_id = $3
        RETURNING
          id,
          user_id AS "userId",
          item_number AS "itemNumber",
          description,
          location,
          status,
          incident_id AS "incidentId",
          created_at AS "createdAt"
      `,
      [
        data.incidentId,
        data.evidenceId,
        authorizedUser.id,
      ],
    )

    if (!result.rows[0]) {
      throw new Error('Evidence item not found')
    }

    return result.rows[0]
  })


export const saveIncident = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      id: string | null
      reportNumber: string
      incidentDate: string
      location: string
      city: string
      state: string
      zipCode: string
      subjectName: string
      subjectPhone: string | null
      subjectDob: string | null
      violentFlag: number
      banBarFlag: number
      incidentCodes: string
      disposition: string
      narrative: string
      approvalStatus: 'Pending' | 'Approved' | 'Rejected'
      reviewFeedback: string | null
      reviewedBy: string | null
      reviewedAt: string | null
      createdAt: string
      caseFileId: string | null
      parentIncidentId: string | null
      reportType: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const authorizedUser = await requireActiveUser()

    if (authorizedUser.role === 'support') {
      throw new Error('Support cannot modify incident reports')
    }

    const customer = await getCustomerContext()
    const db = getDb()
    const now = new Date().toISOString()

    const client = await db.connect()

    try {
      await client.query('BEGIN')

      // --------------------------------------------------
      // EDIT EXISTING INCIDENT
      // --------------------------------------------------

      if (data.id) {
        const existingResult = await client.query<{
          id: string
          user_id: string
          approval_status: string
        }>(
          `
            SELECT
              id,
              user_id,
              approval_status
            FROM incidents
            WHERE id = $1
              AND customer_id = $2
            FOR UPDATE
          `,
          [data.id, customer.id],
        )

        const existing = existingResult.rows[0]

        if (!existing) {
          throw new Error('Incident not found')
        }

        if (
          existing.user_id !== authorizedUser.id &&
          authorizedUser.role !== 'backend'
        ) {
          throw new Error(
            'You cannot edit another officer’s report',
          )
        }

        if (existing.approval_status === 'Approved') {
          throw new Error(
            'Approved reports cannot be edited. Create a supplemental report.',
          )
        }

        const result = await client.query<DashboardIncident>(
          `
            UPDATE incidents
            SET
              incident_date = $1,
              location = $2,
              city = $3,
              state = $4,
              zip_code = $5,
              subject_name = $6,
              subject_phone = $7,
              subject_dob = $8,
              violent_flag = $9,
              ban_bar_flag = $10,
              incident_codes = $11,
              disposition = $12,
              narrative = $13,
              approval_status = 'Pending',
              review_feedback = NULL,
              reviewed_by = NULL,
              reviewed_at = NULL
            WHERE id = $14
              AND customer_id = $15
            RETURNING
              id,
              user_id AS "userId",
              report_number AS "reportNumber",
              incident_date AS "incidentDate",
              location,
              city,
              state,
              zip_code AS "zipCode",
              subject_name AS "subjectName",
              subject_phone AS "subjectPhone",
              subject_dob AS "subjectDob",
              violent_flag AS "violentFlag",
              ban_bar_flag AS "banBarFlag",
              incident_codes AS "incidentCodes",
              disposition,
              narrative,
              approval_status AS "approvalStatus",
              approved_by AS "approvedBy",
              approved_at AS "approvedAt",
              review_feedback AS "reviewFeedback",
              reviewed_by AS "reviewedBy",
              reviewed_at AS "reviewedAt",
              created_at AS "createdAt",
              case_file_id AS "caseFileId",
              parent_incident_id AS "parentIncidentId",
              report_type AS "reportType"
          `,
          [
            data.incidentDate,
            data.location,
            data.city,
            data.state,
            data.zipCode,
            data.subjectName,
            data.subjectPhone,
            data.subjectDob,
            data.violentFlag,
            data.banBarFlag,
            data.incidentCodes,
            data.disposition,
            data.narrative,
            data.id,
            customer.id,
          ],
        )

        const updatedIncident = result.rows[0]

        if (!updatedIncident) {
          throw new Error('Incident update failed')
        }

        await client.query('COMMIT')

        return updatedIncident
      }

      // --------------------------------------------------
      // CREATE NEW ORIGINAL OR SUPPLEMENTAL
      // --------------------------------------------------

      const isSupplemental = Boolean(data.parentIncidentId)

      let reportNumber: string
      let parentIncidentId: string | null = null

      let clientId: string | null = null
      let siteId: string | null = null
      let caseFileId: string | null = null

      if (isSupplemental) {
        // Resolve the original incident even if the user
        // selected an existing supplemental.

        const selectedResult = await client.query<{
          id: string
          parent_incident_id: string | null
        }>(
          `
            SELECT
              id,
              parent_incident_id
            FROM incidents
            WHERE id = $1
              AND customer_id = $2
          `,
          [data.parentIncidentId, customer.id],
        )

        const selected = selectedResult.rows[0]

        if (!selected) {
          throw new Error('Selected incident not found')
        }

        parentIncidentId =
          selected.parent_incident_id || selected.id

        // The original incident is authoritative for
        // organizational and case-file associations.

        const originalResult = await client.query<{
          id: string
          client_id: string | null
          site_id: string | null
          case_file_id: string | null
        }>(
          `
            SELECT
              id,
              client_id,
              site_id,
              case_file_id
            FROM incidents
            WHERE id = $1
              AND customer_id = $2
              AND parent_incident_id IS NULL
            FOR UPDATE
          `,
          [parentIncidentId, customer.id],
        )

        const original = originalResult.rows[0]

        if (!original) {
          throw new Error('Original incident not found')
        }

        clientId = original.client_id
        siteId = original.site_id
        caseFileId = original.case_file_id

        // Numbering is serialized by locking the
        // original incident within this transaction.

        reportNumber =
          await generateSupplementalReportNumber(
            client,
            customer.id,
            parentIncidentId,
          )
      } else {
        // One annual sequence across the entire customer,
        // regardless of client or site.

        const reportYear = new Date().getFullYear()

        const generated =
          await generateOriginalReportNumber(
            client,
            customer.id,
            reportYear,
          )

        reportNumber = generated.reportNumber
      }

      // --------------------------------------------------
      // INSERT INCIDENT
      // --------------------------------------------------

      const result = await client.query<DashboardIncident>(
        `
          INSERT INTO incidents (
            id,
            user_id,
            customer_id,
            report_number,
            incident_date,
            location,
            city,
            state,
            zip_code,
            subject_name,
            subject_phone,
            subject_dob,
            violent_flag,
            ban_bar_flag,
            incident_codes,
            disposition,
            narrative,
            approval_status,
            review_feedback,
            reviewed_by,
            reviewed_at,
            created_at,
            client_id,
            site_id,
            case_file_id,
            parent_incident_id,
            report_type
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15,
            $16, $17, 'Pending', NULL,
            NULL, NULL, $18, $19, $20,
            $21, $22, $23
          )
          RETURNING
            id,
            user_id AS "userId",
            report_number AS "reportNumber",
            incident_date AS "incidentDate",
            location,
            city,
            state,
            zip_code AS "zipCode",
            subject_name AS "subjectName",
            subject_phone AS "subjectPhone",
            subject_dob AS "subjectDob",
            violent_flag AS "violentFlag",
            ban_bar_flag AS "banBarFlag",
            incident_codes AS "incidentCodes",
            disposition,
            narrative,
            approval_status AS "approvalStatus",
            approved_by AS "approvedBy",
            approved_at AS "approvedAt",
            review_feedback AS "reviewFeedback",
            reviewed_by AS "reviewedBy",
            reviewed_at AS "reviewedAt",
            created_at AS "createdAt",
            case_file_id AS "caseFileId",
            parent_incident_id AS "parentIncidentId",
            report_type AS "reportType"
        `,
        [
          crypto.randomUUID(),
          authorizedUser.id,
          customer.id,
          reportNumber,
          data.incidentDate || now.slice(0, 10),
          data.location,
          data.city,
          data.state,
          data.zipCode,
          data.subjectName,
          data.subjectPhone,
          data.subjectDob,
          data.violentFlag,
          data.banBarFlag,
          data.incidentCodes,
          data.disposition,
          data.narrative,
          now,
          clientId,
          siteId,
          caseFileId,
          parentIncidentId,
          isSupplemental ? 'Supplemental' : 'Original',
        ],
      )

      const incident = result.rows[0]

      if (!incident) {
        throw new Error('Incident could not be created')
      }

      await client.query('COMMIT')

      return incident
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })
