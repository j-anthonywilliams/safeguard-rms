import { useState } from 'react'
import {
  DEV_ROLES,
  getDevRole,
  setDevRole,
  clearDevRole,
} from '@/lib/dev-accounts'
import { Button } from '@/components/ui/button'
import { ACCESS_LABELS } from '@/lib/access-control'
import {
  ChevronDown,
  ChevronUp,
  LogOut,
  ShieldCheck,
  X,
} from 'lucide-react'
import { blink } from '@/blink/client'

export function DevAccountSwitcher() {
  if (!import.meta.env.DEV) return null

  const activeRole = getDevRole()
  const [minimized, setMinimized] = useState(true)

  const switchRole = (role: typeof DEV_ROLES[number]['role']) => {
    setDevRole(role)
    window.location.reload()
  }

  const clearDevelopmentRole = () => {
    clearDevRole()
    window.location.reload()
  }

  const signOut = async () => {
    clearDevRole()
    await blink.auth.logout()
  }

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[100]">
        <Button
          type="button"
          variant="outline"
          className="gap-2 bg-card shadow-lg"
          onClick={() => setMinimized(false)}
        >
          <ShieldCheck className="size-4" />

          {activeRole ? (
            <>
              <span>{ACCESS_LABELS[activeRole]}</span>
              <span className="text-[10px] text-muted-foreground">
                DEV
              </span>
            </>
          ) : (
            <span>Development</span>
          )}

          <ChevronUp className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-80 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </div>

          <div>
            <p className="text-sm font-semibold">
              Development Mode
            </p>

            <p className="text-xs text-muted-foreground">
              Emulate SafeGuard permissions.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setMinimized(true)}
          aria-label="Minimize development menu"
        >
          <ChevronDown className="size-4" />
        </Button>
      </div>

      <div className="mb-3 rounded-lg bg-muted/50 p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Current emulation
        </p>

        <p className="mt-1 text-sm font-medium">
          {activeRole
            ? ACCESS_LABELS[activeRole]
            : 'Real account permissions'}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          Your actual Blink account remains authenticated.
        </p>
      </div>

      <div className="grid gap-2">
        {DEV_ROLES.map(item => {
          const active = activeRole === item.role

          return (
            <Button
              key={item.role}
              type="button"
              variant={active ? 'default' : 'outline'}
              className="justify-between"
              onClick={() => switchRole(item.role)}
            >
              <span>{item.label}</span>

              <span className="text-xs opacity-70">
                {ACCESS_LABELS[item.role]}
              </span>
            </Button>
          )
        })}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={clearDevelopmentRole}
        >
          <X className="size-4" />
          Use real permissions
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="mt-2 w-full"
          onClick={signOut}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </div>
  )
}