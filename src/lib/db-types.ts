// Auto-generated from your database schema — do not edit by hand.
// Regenerates automatically whenever a table is created or altered.

export type AppRolesRow = {
  id: string
  userId: string
  role: string
  createdAt: string
  updatedAt: string
}

export type AttendanceLogsRow = {
  id: string
  userId: string
  eventType: string
  eventAt: string
  latitude: number | string | null
  longitude: number | string | null
  accuracy: number | string | null
}

export type CaseFilesRow = {
  id: string
  userId: string
  caseNumber: string
  title: string
  status: string
  leadOfficer: string | null
  createdAt: string
  updatedAt: string
}

export type CustodyEventsRow = {
  id: string
  userId: string
  evidenceId: string
  action: string
  actor: string
  note: string | null
  eventAt: string
}

export type EquipmentRow = {
  id: string
  userId: string
  name: string
  serialNumber: string
  status: string
  assignedTo: string | null
  updatedAt: string
}

export type EvidenceRow = {
  id: string
  userId: string
  itemNumber: string
  description: string
  location: string
  status: string
  createdAt: string
  incidentId: string | null
}

export type IncidentsRow = {
  id: string
  userId: string
  reportNumber: string
  incidentDate: string
  location: string
  subjectName: string
  subjectPhone: string | null
  subjectDob: string | null
  violentFlag: number | string
  banBarFlag: number | string
  incidentCodes: string
  disposition: string
  narrative: string
  createdAt: string
  approvalStatus: string
  approvedBy: string | null
  approvedAt: string | null
  city: string
  state: string
  zipCode: string
  caseFileId: string | null
  parentIncidentId: string | null
  reportType: string
  reviewFeedback: string | null
  reviewedBy: string | null
  reviewedAt: string | null
}

export type UsersRow = {
  id: string
  email: string
  emailVerified: number | string | null
  displayName: string | null
  avatarUrl: string | null
  phone: string | null
  phoneVerified: number | string | null
  role: string | null
  metadata: string | null
  createdAt: string
  updatedAt: string
  lastSignIn: string
}
