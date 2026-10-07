import { createServerFn } from '@tanstack/react-start'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db.server'
import type { AccessLevel } from '@/lib/access-control'

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
  const canViewAllIncidents = ['supervisor', 'admin', 'backend'].includes(
    accessLevel,
  )

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