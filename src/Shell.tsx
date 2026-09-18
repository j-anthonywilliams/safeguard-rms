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
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'

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

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden h-dvh shrink-0 md:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="h-dvh w-64 p-0"
        >
          {sidebar}
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <span className="font-semibold text-sm">
            {appName}
          </span>
        </div>

        {children}
      </main>
    </div>
  )
}