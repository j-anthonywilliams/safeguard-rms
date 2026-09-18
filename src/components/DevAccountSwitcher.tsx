import { DEV_ACCOUNTS, getDevAccount, setDevAccount } from '@/lib/dev-accounts'
import { Button } from '@/components/ui/button'
import { ACCESS_LABELS } from '@/lib/access-control'
import { ShieldCheck } from 'lucide-react'

export function DevAccountSwitcher() {
  if (!import.meta.env.DEV) return null

  const activeAccount = getDevAccount()

  const switchAccount = (accountId: string) => {
    const account = DEV_ACCOUNTS.find(item => item.id === accountId)

    if (!account) return

    setDevAccount(account)
    window.location.reload()
  }

  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-4" />
        </div>

        <div>
          <p className="text-sm font-semibold">Development Accounts</p>
          <p className="text-xs text-muted-foreground">
            Select a permission level without signing in.
          </p>
        </div>
      </div>

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

      {activeAccount && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Active: {activeAccount.displayName}
        </p>
      )}
    </div>
  )
}