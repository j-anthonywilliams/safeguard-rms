import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { blink } from '@/blink/client'
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
import { getDevAccount } from '@/lib/dev-accounts'

interface AppRole {
  id: string
  userId: string
  role: AccessLevel
  createdAt: string
  updatedAt: string
}

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
    last.getDate() + (6 - day)
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
  const [user, setUser] = useState<{
    id: string
    email?: string
    displayName?: string
  } | null>(null)

  const [accessLevel, setAccessLevel] =
    useState<AccessLevel>('user')

  const [users, setUsers] = useState<UserRow[]>([])
  const [scheduleEntries, setScheduleEntries] =
    useState<ScheduleEntry[]>([])
  const [ptoRequests, setPtoRequests] =
    useState<PtoRequest[]>([])

  const [currentMonth, setCurrentMonth] =
    useState(() => new Date())

  const [showShiftEditor, setShowShiftEditor] =
    useState(false)

  const [showPtoEditor, setShowPtoEditor] =
    useState(false)

  const [editingEntry, setEditingEntry] =
    useState<ScheduleEntry | null>(null)

  const [selectedPtoRequest, setSelectedPtoRequest] =
    useState<PtoRequest | null>(null)

  const [loading, setLoading] = useState(true)

  const rolesTable = useMemo(
    () => blink.db.table<AppRole>('app_roles'),
    []
  )

  const usersTable = useMemo(
    () => blink.db.table<UserRow>('users'),
    []
  )

  const scheduleTable = useMemo(
    () => blink.db.table<ScheduleEntry>('schedule_entries'),
    []
  )

  const ptoTable = useMemo(
    () => blink.db.table<PtoRequest>('pto_requests'),
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

    return blink.auth.onAuthStateChanged(state => {
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

  useEffect(() => {
    if (!user) return

    const load = async () => {
      setLoading(true)

      try {
        const [usersResult, scheduleResult, ptoResult] =
          await Promise.all([
            usersTable.list({
              orderBy: { createdAt: 'asc' },
              limit: 500,
            }),

            scheduleTable.list({
              limit: 1000,
            }),

            ptoTable.list({
              limit: 1000,
            }),
          ])

        setUsers(usersResult)
        setScheduleEntries(scheduleResult)
        setPtoRequests(ptoResult)
      } catch (error) {
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
  }, [user, usersTable, scheduleTable, ptoTable])

  const calendarDates = useMemo(
    () =>
      datesBetween(
        startOfCalendar(currentMonth),
        endOfCalendar(currentMonth)
      ),
    [currentMonth]
  )

  const monthLabel = currentMonth.toLocaleDateString(
    'en-US',
    {
      month: 'long',
      year: 'numeric',
    }
  )

  const userName = (userId: string) =>
    users.find(item => item.id === userId)?.displayName ||
    users.find(item => item.id === userId)?.email ||
    userId

  const openNewShift = (date?: string) => {
    if (!canEditSchedule(accessLevel)) return

    const shift =
      date
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
      const now = new Date().toISOString()

      if (entry.id) {
        const updated = await scheduleTable.update(
          entry.id,
          {
            userId: entry.userId,
            shiftDate: entry.shiftDate,
            startTime: entry.startTime,
            endTime: entry.endTime,
            title: entry.title,
            notes: entry.notes || null,
            updatedAt: now,
          }
        )

        setScheduleEntries(current =>
          current.map(item =>
            item.id === entry.id ? updated : item
          )
        )
      } else {
        const created = await scheduleTable.create({
          userId: entry.userId || user.id,
          shiftDate: entry.shiftDate,
          startTime: entry.startTime,
          endTime: entry.endTime,
          title: entry.title,
          notes: entry.notes || null,
          createdAt: now,
          updatedAt: now,
        } as unknown as ScheduleEntry)

        setScheduleEntries(current => [
          created,
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
      const now = new Date().toISOString()

      const created = await ptoTable.create({
        userId: user.id,
        ptoType: data.ptoType,
        startDate: data.startDate,
        endDate: data.endDate,
        notes: data.notes || null,
        status: 'Pending',
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        createdAt: now,
        updatedAt: now,
      } as unknown as PtoRequest)

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
    decision: 'Approved' | 'Denied'
  ) => {
    if (!canEditSchedule(accessLevel) || !user) return

    try {
      const now = new Date().toISOString()

      const updated = await ptoTable.update(
        request.id,
        {
          status: decision,
          reviewedBy: user.id,
          reviewedAt: now,
          updatedAt: now,
        }
      )

      setPtoRequests(current =>
        current.map(item =>
          item.id === request.id ? updated : item
        )
      )

      setSelectedPtoRequest(null)

      toast.success(
        decision === 'Approved'
          ? 'Time off approved'
          : 'Time off request denied'
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

  if (!user || loading) {
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
              <Button onClick={() => openNewShift()}>
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
                        1
                      )
                  )
                }
              >
                <ChevronLeft className="size-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
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
                        1
                      )
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
                  date.getMonth() === currentMonth.getMonth()

                const entries = scheduleEntries.filter(
                  entry => entry.shiftDate === dateString
                )

                const approvedPto = ptoRequests.filter(
                  request =>
                    request.status === 'Approved' &&
                    request.startDate <= dateString &&
                    request.endDate >= dateString
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
                      <span
                        className={`text-xs font-medium ${
                          inMonth
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {date.getDate()}
                      </span>

                      {canEditSchedule(accessLevel) &&
                        inMonth && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() =>
                              openNewShift(dateString)
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
                                accessLevel
                              )
                            )
                              return

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
                onClick={() => setShowPtoEditor(true)}
              >
                <Plus className="size-3.5" />
                Request
              </Button>
            </CardHeader>

            <CardContent className="space-y-2">
              {ptoRequests.filter(
                request => request.userId === user.id
              ).length ? (
                ptoRequests
                  .filter(
                    request => request.userId === user.id
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
                  request => request.status === 'Pending'
                ).length ? (
                  ptoRequests
                    .filter(
                      request => request.status === 'Pending'
                    )
                    .map(request => (
                      <button
                        key={request.id}
                        type="button"
                        onClick={() =>
                          setSelectedPtoRequest(request)
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
          onClose={() => setShowPtoEditor(false)}
          onSubmit={submitPtoRequest}
        />
      )}

      {selectedPtoRequest && (
        <PtoReviewDialog
          request={selectedPtoRequest}
          userName={userName(selectedPtoRequest.userId)}
          onClose={() => setSelectedPtoRequest(null)}
          onApprove={() =>
            reviewPto(selectedPtoRequest, 'Approved')
          }
          onDeny={() =>
            reviewPto(selectedPtoRequest, 'Denied')
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
  const [form, setForm] = useState<ScheduleEntry>(
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
    }
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
            <span className="text-xs font-medium">Employee</span>

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
            <span className="text-xs font-medium">Date</span>
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
              <span className="text-xs font-medium">Start</span>
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
              <span className="text-xs font-medium">End</span>
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
            <span className="text-xs font-medium">Shift title</span>
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
            <span className="text-xs font-medium">Notes</span>
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
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <Button onClick={() => onSave(form)}>
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
  const [ptoType, setPtoType] = useState<PtoType>('Vacation')
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
                setPtoType(event.target.value as PtoType)
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
                  setStartDate(event.target.value)
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
                  setEndDate(event.target.value)
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
          <Button variant="ghost" onClick={onClose}>
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
            <strong>Type:</strong> {request.ptoType}
          </p>

          <p>
            <strong>Dates:</strong> {request.startDate} through{' '}
            {request.endDate}
          </p>

          {request.notes && (
            <p>
              <strong>Notes:</strong> {request.notes}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <Button variant="outline" onClick={onDeny}>
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