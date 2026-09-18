import type { AccessLevel } from '@/lib/access-control'

export interface DevAccount {
  id: string
  email: string
  displayName: string
  role: AccessLevel
}

export const DEV_ACCOUNTS: DevAccount[] = [
  {
    id: 'dev-user',
    email: 'user@safeguard.local',
    displayName: 'Development User',
    role: 'user',
  },
  {
    id: 'dev-supervisor',
    email: 'supervisor@safeguard.local',
    displayName: 'Development Supervisor',
    role: 'supervisor',
  },
  {
    id: 'dev-admin',
    email: 'admin@safeguard.local',
    displayName: 'Development Administrator',
    role: 'admin',
  },
  {
    id: 'dev-support',
    email: 'support@safeguard.local',
    displayName: 'Development Support',
    role: 'support',
  },
  {
    id: 'dev-backend',
    email: 'backend@safeguard.local',
    displayName: 'Development Backend',
    role: 'backend',
  },
]

const DEV_SESSION_KEY = 'safeguard-dev-account'

export function getDevAccount(): DevAccount | null {
  if (!import.meta.env.DEV) return null

  const id = localStorage.getItem(DEV_SESSION_KEY)
  if (!id) return null

  return DEV_ACCOUNTS.find(account => account.id === id) ?? null
}

export function setDevAccount(account: DevAccount) {
  localStorage.setItem(DEV_SESSION_KEY, account.id)
}

export function clearDevAccount() {
  localStorage.removeItem(DEV_SESSION_KEY)
}