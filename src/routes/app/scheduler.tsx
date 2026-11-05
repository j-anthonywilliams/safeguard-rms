import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Save,
  X,
} from 'lucide-react'
import { ACCESS_LABELS, canEditSchedule } from '@/lib/access-control'
import type { AccessLevel } from '@/lib/access-control'
import {
  createPtoRequest,
  getSchedulerData,
  reviewPtoRequest,
  saveScheduleEntry,
} from '@/lib/scheduler.functions'
import { getDevRole } from '@/lib/dev-accounts'

interface UserRow {
  id: string
  email: string
  displayName?: string | null
}

interface ScheduleEntry {
  id: string
  userId: string
  shiftDate: string
  startTime: string
  endTime: string
  title: string
  notes?: string | null
  createdAt: string
  updatedAt: string
}

interface PtoRequest {
  id: string
  userId: string
  ptoType: string
  startDate: string
  endDate: string
  notes?: string | null
  status: 'Pending' | 'Approved' | 'Denied'
  reviewedBy?: string | null
  reviewedAt?: string | null
  reviewNotes?: string | null
  createdAt: string
  updatedAt: string
}

const PTO_TYPES = [
  'Vacation',
  'Sick',
  'Civil/Jury Duty',
  'Military',
  'Bereavement',
] as const

type PtoType = typeof PTO_TYPES[number]

const formatDate = (date: Date) =>
  date.toISOString().slice(0, 10)

const firstDayOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1)

const lastDayOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0)

const startOfCalendar = (date: Date) => {
  const first = firstDayOfMonth(date)
  const day = first.getDay()
  return new Date(first.getFullYear(), first.getMonth(), 1 - day)
}

const endOfCalendar = (date: Date) => {
  const last = lastDayOfMonth(date)
  const day = last.getDay()
  return new Date(
    last.getFullYear(),
    last.getMonth(),
    last.getDate() + (6 - day),
  )
}

const datesBetween = (start: Date, end: Date) => {
  const dates: Date[] = []
  const current = new Date(start)

  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

// Time values are interpreted in the customer's local schedule day.
const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

const shiftRange = (entry: ScheduleEntry, day: string) => {
  const start = timeToMinutes(entry.startTime)
  let end = timeToMinutes(entry.endTime)
  if (end <= start) end += 1440
  const offset = Math.round((new Date(`${entry.shiftDate}T12:00:00`).getTime() - new Date(`${day}T12:00:00`).getTime()) / 86400000) * 1440
  return { start: start + offset, end: end + offset }
}

const previousDate = (day: string) => {
  const date = new Date(`${day}T12:00:00`)
  date.setDate(date.getDate() - 1)
  return formatDate(date)
}

function DailyCoverageTimeline({
  day, entries, ptoRequests, users, editable, onEdit, onCreate,
}: {
  day: string
  entries: ScheduleEntry[]
  ptoRequests: PtoRequest[]
  users: UserRow[]
  editable: boolean
  onEdit: (entry: ScheduleEntry) => void
  onCreate: (time: string) => void
}) {
  const [minimum, setMinimum] = useState(2)
  const nameFor = (id: string) => users.find(user => user.id === id)?.displayName || users.find(user => user.id === id)?.email || id
  const relevant = entries.filter(entry => entry.shiftDate === day || entry.shiftDate === previousDate(day))
    .map(entry => ({ entry, ...shiftRange(entry, day) }))
    .filter(row => row.end > 0 && row.start < 1440)
  const ptoFor = (id: string, status: 'Approved' | 'Pending') => ptoRequests.some(request => request.userId === id && request.status === status && request.startDate <= day && request.endDate >= day)
  const slots = Array.from({ length: 24 }, (_, hour) => {
    const active = relevant.filter(row => row.start < (hour + 1) * 60 && row.end > hour * 60)
    const available = new Set(active.filter(row => !ptoFor(row.entry.userId, 'Approved')).map(row => row.entry.userId)).size
    const pending = new Set(active.filter(row => ptoFor(row.entry.userId, 'Pending')).map(row => row.entry.userId)).size
    return { hour, available, pending, shortage: Math.max(0, minimum - available) }
  })
  const gaps = slots.filter(slot => slot.shortage > 0)
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-semibold">24-hour staffing coverage</h3><p className="text-xs text-muted-foreground">Click a shift to edit or a shortage to build a shift. Approved leave reduces coverage; pending leave is flagged.</p></div>
        <label className="flex items-center gap-2 text-xs">Minimum on duty
          <Input aria-label="Minimum staff on duty" type="number" min={0} max={100} className="h-8 w-20" value={minimum} onChange={event => setMinimum(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} />
        </label>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="size-3 rounded bg-emerald-600" />Scheduled</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded bg-red-600" />Under minimum</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded bg-amber-500" />Pending PTO</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded bg-slate-500" />Approved PTO</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[640px] space-y-2">
          <div className="ml-28 grid grid-cols-8 text-[10px] text-muted-foreground">{Array.from({ length: 8 }, (_, i) => <span key={i}>{String(i * 3).padStart(2, '0')}:00</span>)}</div>
          {relevant.map(({ entry, start, end }) => {
            const approved = ptoFor(entry.userId, 'Approved')
            const pending = ptoFor(entry.userId, 'Pending')
            return <div key={entry.id} className="flex items-center gap-2">
              <span className="w-26 shrink-0 truncate text-xs" title={nameFor(entry.userId)}>{nameFor(entry.userId)}</span>
              <div className="relative h-7 flex-1 rounded bg-muted/40" style={{ backgroundImage: 'linear-gradient(to right, var(--border) 1px, transparent 1px)', backgroundSize: '12.5% 100%' }}>
                <button type="button" disabled={!editable} onClick={() => onEdit(entry)} title={`${entry.title}: ${entry.startTime}-${entry.endTime}${approved ? ' (approved PTO)' : pending ? ' (pending PTO)' : ''}`} className={`absolute top-1 h-5 rounded text-[10px] text-white ${approved ? 'bg-slate-500' : pending ? 'bg-amber-500' : 'bg-emerald-600'} ${editable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`} style={{ left: `${Math.max(0, start) / 1440 * 100}%`, width: `${(Math.min(1440, end) - Math.max(0, start)) / 1440 * 100}%` }} aria-label={`Edit ${entry.title} for ${nameFor(entry.userId)}`} />
              </div>
            </div>
          })}
          {!relevant.length && <p className="text-xs text-muted-foreground">No scheduled shifts on this date.</p>}
          <div className="flex items-center gap-2 pt-2">
            <span className="w-26 shrink-0 text-xs font-semibold">Coverage</span>
            <div className="flex h-9 flex-1 overflow-hidden rounded border" aria-label="Hourly coverage compared with minimum staffing">
              {slots.map(slot => <button type="button" key={slot.hour} disabled={!editable} onClick={() => onCreate(`${String(slot.hour).padStart(2, '0')}:00`)} title={`${String(slot.hour).padStart(2, '0')}:00 — ${slot.available} available, minimum ${minimum}${slot.pending ? `, ${slot.pending} pending PTO` : ''}`} className={`min-w-0 flex-1 border-r border-background/30 text-[9px] font-semibold text-white ${slot.shortage ? 'bg-red-600' : slot.pending ? 'bg-amber-500' : 'bg-emerald-600'} ${editable ? 'hover:brightness-110' : ''}`}>{slot.available}</button>)}
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{gaps.length ? `${gaps.length} hourly interval(s) below minimum; maximum shortage ${Math.max(...gaps.map(slot => slot.shortage))}.` : 'All hourly intervals meet the selected minimum.'} The minimum is a preview control, not a saved staffing rule. Coverage is calculated in one-hour intervals; partial-hour gaps may require closer review.</p>
    </section>
  )
}

export const Route = createFileRoute('/app/scheduler')({
  head: () => ({
    meta: [
      { title: 'Scheduler · SafeGuard RMS' },
      {
        name: 'description',
        content: 'SafeGuard RMS scheduling and time-off management.',
      },
    ],
  }),
  component: SchedulerPage,
})

function SchedulerPage() {
  const {
    data: session,
    isPending: authLoading,
  } = authClient.useSession()

  const userId = session?.user?.id

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.name,
      }
    : null

  const [accessLevel, setAccessLevel] =
    useState<AccessLevel>('user')

  const [users, setUsers] = useState<UserRow[]>([])

  const [scheduleEntries, setScheduleEntries] =
    useState<ScheduleEntry[]>([])

  const [ptoRequests, setPtoRequests] =
    useState<PtoRequest[]>([])

  const [currentMonth, setCurrentMonth] =
    useState(() => new Date())

  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const [showShiftEditor, setShowShiftEditor] =
    useState(false)

  const [showPtoEditor, setShowPtoEditor] =
    useState(false)

  const [editingEntry, setEditingEntry] =
    useState<ScheduleEntry | null>(null)

  const [selectedPtoRequest, setSelectedPtoRequest] =
    useState<PtoRequest | null>(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)

      try {
        const data = await getSchedulerData()
        const devRole = getDevRole()

        setAccessLevel(devRole || data.accessLevel)
        setUsers(data.users)
        setScheduleEntries(data.scheduleEntries)
        setPtoRequests(data.ptoRequests)
      } catch (error) {
        setAccessLevel('user')

        toast.error('Could not load scheduler', {
          description:
            error instanceof Error
              ? error.message
              : 'Please try again.',
        })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [userId])

  const calendarDates = useMemo(
    () =>
      datesBetween(
        startOfCalendar(currentMonth),
        endOfCalendar(currentMonth),
      ),
    [currentMonth],
  )

  const monthLabel = currentMonth.toLocaleDateString(
    'en-US',
    {
      month: 'long',
      year: 'numeric',
    },
  )

  const userName = (requestedUserId: string) =>
    users.find(item => item.id === requestedUserId)
      ?.displayName ||
    users.find(item => item.id === requestedUserId)
      ?.email ||
    requestedUserId

  const openNewShift = (date?: string) => {
    if (!canEditSchedule(accessLevel)) return

    const shift = date
      ? ({
          id: '',
          userId: user?.id || '',
          shiftDate: date,
          startTime: '08:00',
          endTime: '16:00',
          title: 'Regular shift',
          notes: '',
          createdAt: '',
          updatedAt: '',
        } as ScheduleEntry)
      : null

    setEditingEntry(shift)
    setShowShiftEditor(true)
  }

  const saveShift = async (entry: ScheduleEntry) => {
    if (!canEditSchedule(accessLevel) || !user) return

    try {
      const saved = await saveScheduleEntry({
        data: {
          id: entry.id || null,
          userId: entry.userId || user.id,
          shiftDate: entry.shiftDate,
          startTime: entry.startTime,
          endTime: entry.endTime,
          title: entry.title,
          notes: entry.notes || null,
        },
      })

      if (entry.id) {
        setScheduleEntries(current =>
          current.map(item =>
            item.id === entry.id ? saved : item,
          ),
        )
      } else {
        setScheduleEntries(current => [
          saved,
          ...current,
        ])
      }

      setShowShiftEditor(false)
      setEditingEntry(null)

      toast.success('Schedule saved')
    } catch (error) {
      toast.error('Could not save schedule entry', {
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      })
    }
  }

  const submitPtoRequest = async (data: {
    ptoType: PtoType
    startDate: string
    endDate: string
    notes: string
  }) => {
    if (!user) return

    try {
      const created = await createPtoRequest({
        data: {
          ptoType: data.ptoType,
          startDate: data.startDate,
          endDate: data.endDate,
          notes: data.notes || null,
        },
      })

      setPtoRequests(current => [
        created,
        ...current,
      ])

      setShowPtoEditor(false)

      toast.success('Time-off request submitted')
    } catch (error) {
      toast.error('Could not submit request', {
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      })
    }
  }

  const reviewPto = async (
    request: PtoRequest,
    decision: 'Approved' | 'Denied',
  ) => {
    if (!canEditSchedule(accessLevel) || !user) return

    try {
      const updated = await reviewPtoRequest({
        data: {
          requestId: request.id,
          decision,
        },
      })

      setPtoRequests(current =>
        current.map(item =>
          item.id === request.id ? updated : item,
        ),
      )

      setSelectedPtoRequest(null)

      toast.success(
        decision === 'Approved'
          ? 'Time off approved'
          : 'Time off request denied',
      )
    } catch (error) {
      toast.error('Could not update request', {
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      })
    }
  }

  if (authLoading || !user || loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading scheduler…
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background p-5 md:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              Operations
            </p>

            <h1 className="mt-1 font-serif text-3xl">
              Scheduler
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Staffing, shifts, and time-off management.
            </p>

            <div className="mt-3">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-primary">
                {ACCESS_LABELS[accessLevel]} access
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPtoEditor(true)}
            >
              <Clock3 className="size-4" />
              Request time off
            </Button>

            {canEditSchedule(accessLevel) && (
              <Button
                onClick={() => openNewShift()}
              >
                <Plus className="size-4" />
                Add shift
              </Button>
            )}
          </div>
        </header>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4" />
              {monthLabel}
            </CardTitle>

            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCurrentMonth(
                    current =>
                      new Date(
                        current.getFullYear(),
                        current.getMonth() - 1,
                        1,
                      ),
                  )
                }
              >
                <ChevronLeft className="size-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentMonth(new Date())
                }
              >
                Today
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCurrentMonth(
                    current =>
                      new Date(
                        current.getFullYear(),
                        current.getMonth() + 1,
                        1,
                      ),
                  )
                }
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-border">
              {[
                'Sunday',
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday',
              ].map(day => (
                <div
                  key={day}
                  className="border-b border-border bg-muted/30 p-2 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {day.slice(0, 3)}
                </div>
              ))}

              {calendarDates.map(date => {
                const dateString = formatDate(date)

                const inMonth =
                  date.getMonth() ===
                    currentMonth.getMonth() &&
                  date.getFullYear() ===
                    currentMonth.getFullYear()

                const entries = scheduleEntries.filter(
                  entry =>
                    entry.shiftDate === dateString,
                )

                const approvedPto = ptoRequests.filter(
                  request =>
                    request.status === 'Approved' &&
                    request.startDate <= dateString &&
                    request.endDate >= dateString,
                )

                return (
                  <div
                    key={dateString}
                    className={`min-h-32 border-b border-r border-border p-2 ${
                      inMonth
                        ? 'bg-card'
                        : 'bg-muted/10'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <button type="button" onClick={() => setSelectedDay(dateString)} aria-label={`Manage ${dateString}`} className="rounded px-1 text-left hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                      <span
                        className={`text-xs font-medium ${
                          inMonth
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      </button>

                      {canEditSchedule(accessLevel) &&
                        inMonth && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() =>
                              setSelectedDay(dateString)
                            }
                            aria-label={`Add shift for ${dateString}`}
                          >
                            <Plus className="size-3" />
                          </Button>
                        )}
                    </div>

                    <div className="space-y-1">
                      {entries.map(entry => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            if (
                              !canEditSchedule(
                                accessLevel,
                              )
                            ) {
                              return
                            }

                            setSelectedDay(dateString)
                            setEditingEntry(entry)
                            setShowShiftEditor(true)
                          }}
                          className="w-full rounded-md border border-border bg-primary/10 px-2 py-1 text-left text-[10px] hover:bg-primary/20"
                        >
                          <p className="truncate font-medium">
                            {userName(entry.userId)}
                          </p>

                          <p className="truncate text-muted-foreground">
                            {entry.startTime}–
                            {entry.endTime}
                          </p>
                        </button>
                      ))}

                      {approvedPto.map(request => (
                        <div
                          key={`${request.id}-${dateString}`}
                          className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1 text-[10px]"
                        >
                          <p className="font-medium">
                            {userName(request.userId)}
                          </p>

                          <p className="text-muted-foreground">
                            {request.ptoType}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  My time-off requests
                </CardTitle>

                <p className="mt-1 text-xs text-muted-foreground">
                  Requests you have submitted.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() =>
                  setShowPtoEditor(true)
                }
              >
                <Plus className="size-3.5" />
                Request
              </Button>
            </CardHeader>

            <CardContent className="space-y-2">
              {ptoRequests.filter(
                request => request.userId === user.id,
              ).length ? (
                ptoRequests
                  .filter(
                    request =>
                      request.userId === user.id,
                  )
                  .map(request => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {request.ptoType}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {request.startDate} through{' '}
                          {request.endDate}
                        </p>
                      </div>

                      <span className="rounded-full bg-muted px-2 py-1 text-[10px]">
                        {request.status}
                      </span>
                    </div>
                  ))
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No time-off requests.
                </p>
              )}
            </CardContent>
          </Card>

          {canEditSchedule(accessLevel) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Pending approvals
                </CardTitle>

                <p className="mt-1 text-xs text-muted-foreground">
                  Review employee time-off requests.
                </p>
              </CardHeader>

              <CardContent className="space-y-2">
                {ptoRequests.filter(
                  request =>
                    request.status === 'Pending',
                ).length ? (
                  ptoRequests
                    .filter(
                      request =>
                        request.status === 'Pending',
                    )
                    .map(request => (
                      <button
                        key={request.id}
                        type="button"
                        onClick={() =>
                          setSelectedPtoRequest(
                            request,
                          )
                        }
                        className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted/30"
                      >
                        <p className="text-sm font-medium">
                          {userName(request.userId)}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {request.ptoType} ·{' '}
                          {request.startDate} –{' '}
                          {request.endDate}
                        </p>
                      </button>
                    ))
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No pending requests.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      {selectedDay && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedDay(null) }}>
          <section role="dialog" aria-modal="true" aria-label={`Daily shift management for ${selectedDay}`} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Daily Shift Management</p><h2 className="text-xl font-semibold">{selectedDay}</h2></div>
              <Button variant="ghost" size="icon" aria-label="Close daily shift management" onClick={() => setSelectedDay(null)}><X className="size-4" /></Button>
            </div>
            <div className="space-y-5">
              <DailyCoverageTimeline
                day={selectedDay}
                entries={scheduleEntries}
                ptoRequests={ptoRequests}
                users={users}
                editable={canEditSchedule(accessLevel)}
                onEdit={entry => { setEditingEntry(entry); setShowShiftEditor(true) }}
                onCreate={time => {
                  openNewShift(selectedDay)
                  setEditingEntry(current => current ? { ...current, startTime: time, endTime: `${String((Number(time.slice(0, 2)) + 8) % 24).padStart(2, '0')}:00` } : current)
                }}
              />
              <section className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-semibold">Existing shifts</h3>{canEditSchedule(accessLevel) && <Button size="sm" onClick={() => openNewShift(selectedDay)}><Plus className="mr-1 size-4" />Build shift</Button>}</div>
                <div className="space-y-2">
                  {scheduleEntries.filter(entry => entry.shiftDate === selectedDay).map(entry => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div><p className="text-sm font-medium">{entry.title} · {userName(entry.userId)}</p><p className="text-xs text-muted-foreground">{entry.startTime}–{entry.endTime}{entry.notes ? ` · ${entry.notes}` : ''}</p></div>
                      {canEditSchedule(accessLevel) && <Button size="sm" variant="outline" onClick={() => { setEditingEntry(entry); setShowShiftEditor(true) }}>Edit</Button>}
                    </div>
                  ))}
                  {!scheduleEntries.some(entry => entry.shiftDate === selectedDay) && <p className="text-sm text-muted-foreground">No shifts scheduled.</p>}
                </div>
              </section>
              <section className="rounded-lg border p-4">
                <h3 className="mb-3 font-semibold">Time off for this day</h3>
                <div className="space-y-2">
                  {ptoRequests.filter(request => request.startDate <= selectedDay && request.endDate >= selectedDay && (request.status === 'Approved' || request.status === 'Pending')).map(request => (
                    <div key={request.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div><p className="text-sm font-medium">{userName(request.userId)} · {request.ptoType}</p><p className="text-xs text-muted-foreground">{request.startDate}–{request.endDate}</p></div>
                      <span className={`rounded px-2 py-1 text-xs font-medium ${request.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>{request.status}</span>
                    </div>
                  ))}
                  {!ptoRequests.some(request => request.startDate <= selectedDay && request.endDate >= selectedDay && (request.status === 'Approved' || request.status === 'Pending')) && <p className="text-sm text-muted-foreground">No approved or pending time-off requests.</p>}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}

      {showShiftEditor && (
        <ShiftEditor
          entry={editingEntry}
          users={users}
          currentUserId={user.id}
          onClose={() => {
            setShowShiftEditor(false)
            setEditingEntry(null)
          }}
          onSave={saveShift}
        />
      )}

      {showPtoEditor && (
        <PtoRequestEditor
          onClose={() =>
            setShowPtoEditor(false)
          }
          onSubmit={submitPtoRequest}
        />
      )}

      {selectedPtoRequest && (
        <PtoReviewDialog
          request={selectedPtoRequest}
          userName={userName(
            selectedPtoRequest.userId,
          )}
          onClose={() =>
            setSelectedPtoRequest(null)
          }
          onApprove={() =>
            reviewPto(
              selectedPtoRequest,
              'Approved',
            )
          }
          onDeny={() =>
            reviewPto(
              selectedPtoRequest,
              'Denied',
            )
          }
        />
      )}
    </div>
  )
}

function ShiftEditor({
  entry,
  users,
  currentUserId,
  onClose,
  onSave,
}: {
  entry: ScheduleEntry | null
  users: UserRow[]
  currentUserId: string
  onClose: () => void
  onSave: (entry: ScheduleEntry) => void
}) {
  const [form, setForm] =
    useState<ScheduleEntry>(
      entry || {
        id: '',
        userId: currentUserId,
        shiftDate: formatDate(new Date()),
        startTime: '08:00',
        endTime: '16:00',
        title: 'Regular shift',
        notes: '',
        createdAt: '',
        updatedAt: '',
      },
    )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Schedule
            </p>

            <h2 className="text-xl font-semibold">
              {entry ? 'Edit shift' : 'Add shift'}
            </h2>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="grid gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-medium">
              Employee
            </span>

            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.userId}
              onChange={event =>
                setForm({
                  ...form,
                  userId: event.target.value,
                })
              }
            >
              {users.map(item => (
                <option key={item.id} value={item.id}>
                  {item.displayName || item.email}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium">
              Date
            </span>

            <Input
              type="date"
              value={form.shiftDate}
              onChange={event =>
                setForm({
                  ...form,
                  shiftDate: event.target.value,
                })
              }
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium">
                Start
              </span>

              <Input
                type="time"
                value={form.startTime}
                onChange={event =>
                  setForm({
                    ...form,
                    startTime: event.target.value,
                  })
                }
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium">
                End
              </span>

              <Input
                type="time"
                value={form.endTime}
                onChange={event =>
                  setForm({
                    ...form,
                    endTime: event.target.value,
                  })
                }
              />
            </label>
          </div>

          <label className="space-y-1.5">
            <span className="text-xs font-medium">
              Shift title
            </span>

            <Input
              value={form.title}
              onChange={event =>
                setForm({
                  ...form,
                  title: event.target.value,
                })
              }
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium">
              Notes
            </span>

            <textarea
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.notes || ''}
              onChange={event =>
                setForm({
                  ...form,
                  notes: event.target.value,
                })
              }
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            onClick={() => onSave(form)}
          >
            <Save className="size-4" />
            Save shift
          </Button>
        </div>
      </div>
    </div>
  )
}

function PtoRequestEditor({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (data: {
    ptoType: PtoType
    startDate: string
    endDate: string
    notes: string
  }) => void
}) {
  const [ptoType, setPtoType] =
    useState<PtoType>('Vacation')

  const [startDate, setStartDate] =
    useState(formatDate(new Date()))

  const [endDate, setEndDate] =
    useState(formatDate(new Date()))

  const [notes, setNotes] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Time off
            </p>

            <h2 className="text-xl font-semibold">
              Request time off
            </h2>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="grid gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-medium">
              PTO type
            </span>

            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={ptoType}
              onChange={event =>
                setPtoType(
                  event.target.value as PtoType,
                )
              }
            >
              {PTO_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium">
                Start date
              </span>

              <Input
                type="date"
                value={startDate}
                onChange={event =>
                  setStartDate(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium">
                End date
              </span>

              <Input
                type="date"
                value={endDate}
                onChange={event =>
                  setEndDate(
                    event.target.value,
                  )
                }
              />
            </label>
          </div>

          <label className="space-y-1.5">
            <span className="text-xs font-medium">
              Notes
            </span>

            <textarea
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Optional notes for the reviewer..."
              value={notes}
              onChange={event =>
                setNotes(event.target.value)
              }
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            onClick={() =>
              onSubmit({
                ptoType,
                startDate,
                endDate,
                notes,
              })
            }
          >
            Submit request
          </Button>
        </div>
      </div>
    </div>
  )
}

function PtoReviewDialog({
  request,
  userName,
  onClose,
  onApprove,
  onDeny,
}: {
  request: PtoRequest
  userName: string
  onClose: () => void
  onApprove: () => void
  onDeny: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              PTO request
            </p>

            <h2 className="text-xl font-semibold">
              {userName}
            </h2>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-5 space-y-2 text-sm">
          <p>
            <strong>Type:</strong>{' '}
            {request.ptoType}
          </p>

          <p>
            <strong>Dates:</strong>{' '}
            {request.startDate} through{' '}
            {request.endDate}
          </p>

          {request.notes && (
            <p>
              <strong>Notes:</strong>{' '}
              {request.notes}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            variant="outline"
            onClick={onDeny}
          >
            Deny
          </Button>

          <Button onClick={onApprove}>
            Approve
          </Button>
        </div>
      </div>
    </div>
  )
}