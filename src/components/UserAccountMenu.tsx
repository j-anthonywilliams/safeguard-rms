import { useEffect, useMemo, useRef, useState } from 'react'
import { blink } from '@/blink/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ACCESS_LABELS } from '@/lib/access-control'
import type { AccessLevel } from '@/lib/access-control'
import { getDevRole } from '@/lib/dev-accounts'
import { LogOut, Settings, UserRound } from 'lucide-react'

interface AppRole {
  id: string
  userId: string
  role: AccessLevel
  createdAt: string
  updatedAt: string
}

export function UserAccountMenu() {
  const [user, setUser] = useState<{
    id: string
    email?: string
    displayName?: string
  } | null>(null)

  const [accessLevel, setAccessLevel] =
    useState<AccessLevel>('user')

  const [open, setOpen] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)

  const rolesTable = useMemo(
    () => blink.db.table<AppRole>('app_roles'),
    []
  )

  useEffect(() => {
    return blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)

      if (!state.user) {
        setAccessLevel('user')
        return
      }

      const devRole = getDevRole()

      if (devRole) {
        setAccessLevel(devRole)
        return
      }

      rolesTable
        .list({
          where: { userId: state.user.id },
          limit: 1,
        })
        .then(rows =>
          setAccessLevel(rows[0]?.role || 'user')
        )
        .catch(() => setAccessLevel('user'))
    })
  }, [rolesTable])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      )
    }
  }, [])

  const displayName =
    user?.displayName || user?.email || 'Officer'

  const initials = displayName
    .slice(0, 2)
    .toUpperCase()

  const signOut = async () => {
    setOpen(false)
    await blink.auth.logout()
  }

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="ghost"
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex h-auto items-center gap-2 px-2 py-1.5"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-muted text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="hidden min-w-0 text-left sm:block">
          <p className="max-w-40 truncate text-xs font-medium">
            {displayName}
          </p>

          <p className="text-[10px] text-muted-foreground">
            {ACCESS_LABELS[accessLevel]} access
          </p>
        </div>
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 rounded-lg border border-border bg-card p-1 text-card-foreground shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-medium">
              {displayName}
            </p>

            <p className="truncate text-xs text-muted-foreground">
              {user?.email || ''}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              {ACCESS_LABELS[accessLevel]} access
            </p>
          </div>

          <a
            href="/app/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <UserRound className="h-4 w-4" />
            My profile
          </a>

          <a
            href="/app/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Settings className="h-4 w-4" />
            Account settings
          </a>

          <div className="my-1 border-t border-border" />

          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}