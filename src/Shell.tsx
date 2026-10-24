/**
 * Shell — Mobile-responsive app layout (shadcn/ui based).
 *
 * Desktop (md+):
 *   - Sidebar remains stationary at the left side of the viewport.
 *   - Main content occupies the remaining width and scrolls independently.
 *
 * Mobile:
 *   - Sidebar is hidden.
 *   - Sidebar opens in a Sheet drawer from the left.
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Menu, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { UserAccountMenu } from '@/components/UserAccountMenu'

interface ShellProps {
  sidebar: ReactNode
  appName?: string
  children: ReactNode
}

export function Shell({
  sidebar,
  appName = 'App',
  children,
}: ShellProps) {
  const [open, setOpen] = useState(false)
  // System appearance is authoritative; changes apply without a page reload.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => document.documentElement.classList.toggle('dark', media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <header className="z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </Button>
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></span>
        <span className="text-sm font-semibold">{appName}</span>
        <div className="ml-auto flex items-center gap-2">
          <UserAccountMenu />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden h-full shrink-0 md:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="h-full w-64 p-0"
        >
          {sidebar}
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {children}
      </main>
      </div>
    </div>
  )
}