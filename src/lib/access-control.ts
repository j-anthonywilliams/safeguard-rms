export type AccessLevel = 'user' | 'supervisor' | 'admin' | 'support' | 'backend'

export const ACCESS_LEVELS: AccessLevel[] = ['user', 'supervisor', 'admin', 'support', 'backend']

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  user: 'User',
  supervisor: 'Supervisor',
  admin: 'Admin',
  support: 'Support',
  backend: 'Backend',
}

export const canCreateRecords = (level: AccessLevel) => level !== 'support'
export const canManageUsers = (level: AccessLevel) => ['admin', 'support', 'backend'].includes(level)
