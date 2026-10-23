export type AccessLevel =
  | 'user'
  | 'supervisor'
  | 'investigator'
  | 'office_staff'
  | 'admin'
  | 'support'
  | 'backend'

export const ACCESS_LEVELS: AccessLevel[] = [
  'user',
  'supervisor',
  'investigator',
  'office_staff',
  'admin',
  'support',
  'backend',
]

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  user: 'User',
  supervisor: 'Supervisor',
  investigator: 'Investigator',
  office_staff: 'Office Staff',
  admin: 'Admin',
  support: 'Support',
  backend: 'Backend',
}

export const canCreateRecords = (level: AccessLevel) =>
  level !== 'support' && level !== 'office_staff'

export const canManageUsers = (level: AccessLevel) =>
  ['admin', 'support', 'backend'].includes(level)

export const canEditSchedule = (level: AccessLevel) =>
  ['supervisor', 'investigator', 'admin', 'backend'].includes(level)

/**
 * Roles that each access level is permitted to assign.
 *
 * User        -> no role-management authority
 * Supervisor  -> no role-management authority
 * Admin       -> Supervisor, User
 * Support     -> Admin, Supervisor, User
 * Backend     -> Backend, Support, Admin, Supervisor, User
 */
export const GRANTABLE_ROLES: Record<
  AccessLevel,
  AccessLevel[]
> = {
  user: [],
  supervisor: [],
  investigator: [],
  office_staff: [],
  admin: ['supervisor', 'investigator', 'office_staff', 'user'],
  support: [],
  backend: ['admin', 'supervisor', 'investigator', 'office_staff', 'user'],
}

export const canGrantRole = (
  currentRole: AccessLevel,
  targetRole: AccessLevel
) =>
  GRANTABLE_ROLES[currentRole].includes(targetRole)