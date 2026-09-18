import { useEffect, useMemo, useState } from 'react'
import { blink } from '@/blink/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ACCESS_LABELS } from '@/lib/access-control'
import type { AccessLevel } from '@/lib/access-control'
import { getDevAccount } from '@/lib/dev-accounts'
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

  const [accessLevel, setAccessLevel] = useState<AccessLevel>('user')

  const rolesTable = useMemo(
    () => blink.db.table<AppRole>('app_roles'),
    []
  )

  useEffect(() => {
    const devAccount = getDevAccount()

    if (devAccount) {
      setUser({
        id: devAccount.id,
        email: devAccount.email,
        displayName: devAccount.displayName,
      })
      setAccessLevel(devAccount.role)
      return
    }

    return blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)

      if (!state.user) {
        setAccessLevel('user')
        return
      }

      rolesTable
        .list({
          where: { userId: state.user.id },
          limit: 1,
        })
        .then(rows => setAccessLevel(rows[0]?.role || 'user'))
        .catch(() => setAccessLevel('user'))
    })
  }, [rolesTable])

  const displayName = user?.displayName || user?.email || 'Officer'
  const initials = displayName.slice(0, 2).toUpperCase()

  const signOut = async () => {
    await blink.auth.logout()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-auto items-center gap-2 px-2 py-1.5"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-muted">
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
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span>{displayName}</span>

            <span className="font-normal text-muted-foreground">
              {user?.email || ''}
            </span>

            <span className="mt-1 font-normal text-muted-foreground">
              {ACCESS_LABELS[accessLevel]} access
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a href="/app/profile">
            <UserRound className="mr-2 h-4 w-4" />
            My profile
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a href="/app/profile">
            <Settings className="mr-2 h-4 w-4" />
            Account settings
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}