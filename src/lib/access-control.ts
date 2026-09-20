export type AccessLevel =
  | 'user'
  | 'supervisor'
  | 'admin'
  | 'support'
  | 'backend'

export const ACCESS_LEVELS: AccessLevel[] = [
  'user',
  'supervisor',
  'admin',
  'support',
  'backend',
]

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  user: 'User',
  supervisor: 'Supervisor',
  admin: 'Admin',
  support: 'Support',
  backend: 'Backend',
}

export const canCreateRecords = (level: AccessLevel) =>
  level !== 'support'

export const canManageUsers = (level: AccessLevel) =>
  ['admin', 'support', 'backend'].includes(level)

export const canEditSchedule = (level: AccessLevel) =>
  ['supervisor', 'admin', 'support', 'backend'].includes(level)

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
  admin: ['supervisor', 'user'],
  support: ['admin', 'supervisor', 'user'],
  backend: [
    'backend',
    'support',
    'admin',
    'supervisor',
    'user',
  ],
}

export const canGrantRole = (
  currentRole: AccessLevel,
  targetRole: AccessLevel
) =>
  GRANTABLE_ROLES[currentRole].includes(targetRole)