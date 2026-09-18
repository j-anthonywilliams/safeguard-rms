import {
  DEV_ACCOUNTS,
  getDevAccount,
  setDevAccount,
  clearDevAccount,
} from '@/lib/dev-accounts'
import { Button } from '@/components/ui/button'
import { ACCESS_LABELS } from '@/lib/access-control'
import { ShieldCheck, LogIn, X } from 'lucide-react'

export function DevAccountSwitcher() {
  if (!import.meta.env.DEV) return null

  const activeAccount = getDevAccount()

  const switchAccount = (accountId: string) => {
    const account = DEV_ACCOUNTS.find(item => item.id === accountId)

    if (!account) return

    setDevAccount(account)
    window.location.reload()
  }

  const signInToRealAccount = () => {
    clearDevAccount()
    window.location.reload()
  }

  const exitDevelopmentMode = () => {
    clearDevAccount()
    window.location.reload()
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-80 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-4" />
        </div>

        <div>
          <p className="text-sm font-semibold">Development Mode</p>
          <p className="text-xs text-muted-foreground">
            Switch permission levels without signing in.
          </p>
        </div>
      </div>

      {activeAccount && (
        <div className="mb-3 rounded-lg bg-muted/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Active account
          </p>

          <p className="mt-1 text-sm font-medium">
            {activeAccount.displayName}
          </p>

          <p className="text-xs text-muted-foreground">
            {ACCESS_LABELS[activeAccount.role]}
          </p>
        </div>
      )}

      <div className="grid gap-2">
        {DEV_ACCOUNTS.map(account => {
          const active = activeAccount?.id === account.id

          return (
            <Button
              key={account.id}
              type="button"
              variant={active ? 'default' : 'outline'}
              className="justify-between"
              onClick={() => switchAccount(account.id)}
            >
              <span>{account.displayName}</span>

              <span className="text-xs opacity-70">
                {ACCESS_LABELS[account.role]}
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
          onClick={signInToRealAccount}
        >
          <LogIn className="size-4" />
          Sign in with my real account
        </Button>

        {activeAccount && (
          <Button
            type="button"
            variant="ghost"
            className="mt-2 w-full"
            onClick={exitDevelopmentMode}
          >
            <X className="size-4" />
            Exit development mode
          </Button>
        )}
      </div>
    </div>
  )
}