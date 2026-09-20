import type { AccessLevel } from '@/lib/access-control'

export interface DevRole {
  role: AccessLevel
  label: string
}

export const DEV_ROLES: DevRole[] = [
  {
    role: 'user',
    label: 'User',
  },
  {
    role: 'supervisor',
    label: 'Supervisor',
  },
  {
    role: 'admin',
    label: 'Admin',
  },
  {
    role: 'support',
    label: 'Support',
  },
  {
    role: 'backend',
    label: 'Backend',
  },
]

const DEV_ROLE_KEY = 'safeguard-dev-role'

export function getDevRole(): AccessLevel | null {
  if (!import.meta.env.DEV) return null

  const role = localStorage.getItem(DEV_ROLE_KEY)

  if (!role) return null

  const validRole = DEV_ROLES.some(
    item => item.role === role
  )

  return validRole ? (role as AccessLevel) : null
}

export function setDevRole(role: AccessLevel) {
  if (!import.meta.env.DEV) return

  localStorage.setItem(DEV_ROLE_KEY, role)
}

export function clearDevRole() {
  localStorage.removeItem(DEV_ROLE_KEY)
}