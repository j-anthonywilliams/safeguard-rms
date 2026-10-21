import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'
import { getOrganizationStructure } from '@/lib/organization.functions'
import {
  createAttendanceLog,
  createCaseFile,
  createEvidence,
  createEquipment,
  getDashboardData,
  getPanelEvidence,
  reviewIncident as reviewIncidentServer,
  saveIncident,
  updateEvidenceIncident,
} from '@/lib/dashboard.functions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { AlertTriangle, Archive, ArrowUpRight, Check, ClipboardPlus, Clock3, Crosshair, Eye, FileText, MapPin, MessageSquare, Moon, Package, Plus, ShieldCheck, Sun, Users, X } from 'lucide-react'
import { ACCESS_LABELS, canCreateRecords } from '@/lib/access-control'
import type { AttendanceLogsRow } from '@/lib/db-types'
import type { AccessLevel } from '@/lib/access-control'
import { getDevRole } from '@/lib/dev-accounts'
import { DevAccountSwitcher } from '@/components/DevAccountSwitcher'
import { UserAccountMenu } from '@/components/UserAccountMenu'


interface Incident {
  id: string
  userId: string
  reportNumber: string
  incidentDate: string
  location: string
  city: string
  state: string
  zipCode: string
  subjectName: string
  subjectPhone?: string | null
  subjectDob?: string | null
  violentFlag: string | number
  banBarFlag: string | number
  incidentCodes: string
  disposition: string
  narrative: string
  approvalStatus: 'Pending' | 'Approved' | 'Rejected'
  approvedBy?: string | null
  approvedAt?: string | null
  reviewFeedback?: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
  createdAt: string
  caseFileId?: string | null
  parentIncidentId?: string | null
  reportType?: string
  clientId?: string | null
  siteId?: string | null
}
interface CaseFile { id: string; userId: string; caseNumber: string; title: string; status: string; leadOfficer?: string | null; createdAt: string; updatedAt: string }
interface Equipment { id: string; name: string; serialNumber: string; status: string; assignedTo?: string; updatedAt: string }
interface Evidence { id: string; itemNumber: string; description: string; location: string; status: string; incidentId?: string | null; createdAt: string }
interface CustodyEvent { id: string; userId: string; evidenceId: string; action: string; actor: string; note?: string; eventAt: string }
interface AppRole { id: string; userId: string; role: AccessLevel; createdAt: string; updatedAt: string }
interface CodeDisposition { code: string; disposition: string }

const canApproveIncidents = (level: AccessLevel) => ['supervisor', 'admin', 'backend'].includes(level)
const approvalBadgeClass: Record<Incident['approvalStatus'], string> = { Pending: 'bg-accent text-accent-foreground', Approved: 'bg-chart-3/20 text-foreground', Rejected: 'bg-destructive/15 text-destructive' }
const getApprovalStatus = (status?: Incident['approvalStatus']) => status || 'Pending'

const DISPOSITIONS = [
  'Open',
  'Cleared by Arrest',
  'Cleared by Citation',
  'Non-Criminal',
  'Cleared by Exception',
] as const

const parseCodeDispositions = (
  incident: Pick<Incident, 'incidentCodes' | 'disposition'>
): CodeDisposition[] => {
  const parseValue = (value: string): unknown => {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  const rawCodes = parseValue(incident.incidentCodes || '')
  const rawDispositions = parseValue(incident.disposition || '')

  // Current format: disposition contains complete code/disposition pairs.
  if (
    Array.isArray(rawDispositions) &&
    rawDispositions.every(
      item =>
        item !== null &&
        typeof item === 'object' &&
        typeof item.code === 'string' &&
        typeof item.disposition === 'string'
    )
  ) {
    return rawDispositions.map(item => ({
      code: item.code,
      disposition: item.disposition,
    }))
  }

  // Legacy format: incidentCodes contains complete pairs.
  if (
    Array.isArray(rawCodes) &&
    rawCodes.every(
      item =>
        item !== null &&
        typeof item === 'object' &&
        typeof item.code === 'string'
    )
  ) {
    return rawCodes.map(item => ({
      code: item.code,
      disposition: item.disposition || '',
    }))
  }

  const codes = Array.isArray(rawCodes)
    ? rawCodes.filter(
        (item): item is string => typeof item === 'string'
      )
    : String(rawCodes).split(',').map(value => value.trim()).filter(Boolean)

  const dispositions = Array.isArray(rawDispositions)
    ? rawDispositions.filter(
        (item): item is string => typeof item === 'string'
      )
    : String(rawDispositions).split(',').map(value => value.trim())

  return codes.map((code, index) => ({
    code,
    disposition: dispositions[index] || dispositions[0] || '',
  }))
}

export const Route = createFileRoute('/app/')({
  head: () => ({ meta: [{ title: 'Command Center · SafeGuard RMS' }, { name: 'description', content: 'SafeGuard RMS public safety report management command center.' }] }),
  component: DashboardHome,
})

function LoadingShell() { return <div className="flex min-h-dvh items-center justify-center bg-background"><div className="flex items-center gap-3 text-sm text-muted-foreground"><ShieldCheck className="size-5 animate-pulse text-primary" /> Loading command center…</div></div> }

function DashboardHome() {
  const { data: session, isPending: authLoading } = authClient.useSession()
  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.name,
      }
    : null
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [events, setEvents] = useState<CustodyEvent[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogsRow[]>([])
  const [clockBusy, setClockBusy] = useState(false)
  const [activePanel, setActivePanel] = useState<'incident' | 'equipment' | 'evidence' | 'case' | 'review' | null>(null)
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null)
  const [reviewingIncident, setReviewingIncident] = useState<Incident | null>(null)
  const [rejectionFeedback, setRejectionFeedback] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  const [dark, setDark] = useState(false)
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('user')
  const [directoryUsers, setDirectoryUsers] = useState<{ id: string; email: string; displayName?: string | null }[]>([])
  
  useEffect(() => { 
  const saved = localStorage.getItem('safeguard-theme') === 'dark'; document.documentElement.classList.toggle('dark', saved); setTimeout(() => setDark(saved), 0) }, [])

  useEffect(() => {
    if (!user) return

    const loadRecords = async () => {
      try {
        const data = await getDashboardData()

        setAccessLevel(data.accessLevel)
        setIncidents(data.incidents)

        setEquipment(
          data.equipment.map(item => ({
            ...item,
            assignedTo: item.assignedTo ?? undefined,
          }))
        )

        setEvents(
          data.events.map(item => ({
            ...item,
            note: item.note ?? undefined,
          }))
        )
        setCaseFiles(data.caseFiles)
        setEvidence(data.evidence)
        setAttendanceLogs(data.attendanceLogs)
        setDirectoryUsers(data.directoryUsers)
      } catch (error) {
        toast.error('Could not load records', {
          description:
            error instanceof Error
              ? error.message
              : 'Please try again.',
        })
      }
    }

    loadRecords()
  }, [user])

  const availableEquipment = useMemo(() => equipment.filter(item => item.status === 'Available').length, [equipment])
  const activeCases = useMemo(() => caseFiles.filter(file => !['closed', 'archived', 'complete'].includes(file.status.toLowerCase())), [caseFiles])
  const pendingReviews = useMemo(() => incidents.filter(item => getApprovalStatus(item.approvalStatus) === 'Pending'), [incidents])
  const toggleTheme = () => { const next = !dark; setDark(next); localStorage.setItem('safeguard-theme', String(next)); document.documentElement.classList.toggle('dark', next) }
  const clockEvent = (eventType: 'clock_in' | 'clock_out') => {
    if (!user || clockBusy) return
    setClockBusy(true)
    const saveLog = (latitude: number | null = null, longitude: number | null = null, accuracy: number | null = null) => {
      const log = { userId: user.id, eventType, eventAt: new Date().toISOString(), latitude, longitude, accuracy }
            createAttendanceLog({
        data: {
          eventType: log.eventType,
          latitude: log.latitude,
          longitude: log.longitude,
          accuracy: log.accuracy,
        },
      })
        .then(saved => {
          setAttendanceLogs(current => [saved, ...current])
          toast.success(
            eventType === 'clock_in' ? 'Clocked in' : 'Clocked out',
            {
              description:
                latitude === null
                  ? 'Time recorded. Location was unavailable.'
                  : 'Time and GPS location recorded.',
            },
          )
        })
        .catch((error: Error) =>
          toast.error('Could not record attendance', {
            description: error.message,
          }),
        )
        .finally(() => setClockBusy(false))
    }
    if (!navigator.geolocation) { saveLog(); return }
    navigator.geolocation.getCurrentPosition(position => saveLog(position.coords.latitude, position.coords.longitude, position.coords.accuracy), () => saveLog(), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
  }
  const lastAttendance = attendanceLogs[0]
  const isClockedIn = lastAttendance?.eventType === 'clock_in'
    
  const reviewIncident = (incident: Incident) => { setReviewingIncident(incident); setActivePanel('review') }
  
  const decideIncident = async (
    decision: 'Approved' | 'Rejected',
    feedback: string,
  ) => {
    if (!reviewingIncident || !canApproveIncidents(accessLevel)) {
      return
    }

    if (reviewBusy) {
      return
    }

    if (decision === 'Rejected' && !feedback.trim()) {
      toast.error('Feedback is required', {
        description:
          'Tell the originating officer what needs to change.',
      })
      return
    }

    setReviewBusy(true)

    try {
      const updatedIncident = await reviewIncidentServer({
        data: {
          incidentId: reviewingIncident.id,
          decision,
          feedback: feedback.trim(),
        },
      })

      setIncidents(current =>
        current.map(item =>
          item.id === reviewingIncident.id
            ? updatedIncident
            : item,
        ),
      )

      setActivePanel(null)
      setReviewingIncident(null)
      setRejectionFeedback('')

      toast.success(
        decision === 'Approved'
          ? 'Report approved'
          : 'Report returned to officer',
        {
          description:
            decision === 'Approved'
              ? `${reviewingIncident.reportNumber} is approved.`
              : 'The officer can update the report and resubmit it.',
        },
      )
    } catch (error) {
      toast.error('Could not update review', {
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      })
    } finally {
      setReviewBusy(false)
    }
  }

  const openIncidentEditor = (incident?: Incident) => {
    setEditingIncident(incident || null)
    setActivePanel('incident')
  }
  const openSupplementalEditor = (incident: Incident) => {
    const base = incident.reportNumber.split('.')[0]
    const nextNumber = incidents.filter(item => item.parentIncidentId === incident.id || item.reportNumber.startsWith(`${base}.`)).length + 1
    setEditingIncident({ ...incident, id: '', reportNumber: `${base}.${nextNumber}`, reportType: 'Supplemental', parentIncidentId: incident.id, narrative: '', incidentCodes: '[]', disposition: '[]', approvalStatus: 'Pending', createdAt: new Date().toISOString() })
    setActivePanel('incident')
  }
  const printAllIncidents = () => window.print()
  if (authLoading) return <LoadingShell />
  if (!user) return <LoginGate />
  const recordUserId = user.id
  const displayUser = user || { id: recordUserId, email: 'development@local', displayName: 'Development officer' }

return (
  <div className="min-h-dvh bg-background text-foreground">
    <header className="border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-8">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
            <ShieldCheck className="size-5" />
          </div>

          <div>
            <p className="text-sm font-semibold tracking-tight">
              SafeGuard RMS
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Operations / Command center
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle light and dark mode"
          >
            {dark ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>

          <UserAccountMenu />
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-[1440px] space-y-7 px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Tuesday · September 01, 2026
          </p>

          <h1 className="font-serif text-3xl tracking-tight md:text-4xl">
            Good evening, {displayUser.displayName?.split(' ')[0] || 'Officer'}.
          </h1>

          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Your operational picture at a glance. Keep reports precise, custody continuous, and your team equipped.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-primary">
              {ACCESS_LABELS[accessLevel]} access
            </span>

            <span className="text-xs text-muted-foreground">
              Five-level access control is active
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={isClockedIn ? 'outline' : 'default'}
            onClick={() => clockEvent(isClockedIn ? 'clock_out' : 'clock_in')}
            disabled={clockBusy}
          >
            <MapPin className="size-4" />
            {clockBusy ? 'Locating…' : isClockedIn ? 'Clock out' : 'Clock in'}
          </Button>

          <Button
            variant="outline"
            onClick={() => setActivePanel('evidence')}
            disabled={!canCreateRecords(accessLevel)}
          >
            <Archive className="size-4" />
            Log property
          </Button>

          <Button
            onClick={() => openIncidentEditor()}
            disabled={!canCreateRecords(accessLevel)}
          >
            <Plus className="size-4" />
            New report
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric
          icon={<FileText />}
          label="Open reports"
          value={String(incidents.length)}
          detail="Needs disposition review"
          accent="bg-primary"
        />

        <Metric
          icon={<AlertTriangle />}
          label="Flagged subjects"
          value={String(
            incidents.filter(
              i => Number(i.violentFlag) || Number(i.banBarFlag)
            ).length
          )}
          detail="Violent or ban / bar"
          accent="bg-destructive"
        />

        <Metric
          icon={<ClipboardPlus />}
          label="Active cases"
          value={String(activeCases.length)}
          detail="Open operational files"
          accent="bg-chart-2"
        />

        <Metric
          icon={<Package />}
          label="Available equipment"
          value={String(availableEquipment)}
          detail={`${equipment.length} total tracked`}
          accent="bg-chart-3"
        />

        <Metric
          icon={<Clock3 />}
          label="Custody events"
          value={String(events.length)}
          detail="Latest activity log"
          accent="bg-accent"
        />
      </section>


      {canApproveIncidents(accessLevel) && (
        <Card className="overflow-hidden border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/30 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4" />
                Supervisor Review Queue
              </CardTitle>

              <p className="mt-1 text-xs text-muted-foreground">
                {pendingReviews.length === 0
                  ? 'No reports are waiting for approval.'
                  : `${pendingReviews.length} report${
                      pendingReviews.length === 1 ? '' : 's'
                    } awaiting supervisory review.`}
              </p>
            </div>

            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {pendingReviews.length} Pending
            </span>
          </CardHeader>

          <CardContent className="p-0">
            {pendingReviews.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                <Check className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  All reports have been reviewed.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pendingReviews.map(incident => {
                  const originatingOfficer =
                    directoryUsers.find(
                      officer => officer.id === incident.userId,
                    )

                  return (
                    <div
                      key={incident.id}
                      className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold">
                            {incident.reportNumber}
                          </span>

                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                            Pending
                          </span>

                          {incident.reportType === 'Supplemental' && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                              Supplemental
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-foreground">
                          {incident.location || 'Location not specified'}
                        </p>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            Incident: {incident.incidentDate}
                          </span>

                          <span>
                            Officer:{' '}
                            {originatingOfficer?.displayName ||
                              originatingOfficer?.email ||
                              'Unknown'}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => reviewIncident(incident)}
                      >
                        <Eye className="mr-2 size-4" />
                        Open Report
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <section
        id="incidents"
        className="scroll-mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]"
      >
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/30 pb-4">
            <div>
              <CardTitle className="text-base">
                Recent incident reports
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Your latest reports and review status
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => openIncidentEditor()}
              disabled={!canCreateRecords(accessLevel)}
            >
              Create report
              <ArrowUpRight className="size-3.5" />
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            {incidents.length ? (
              incidents.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 transition-colors last:border-0 hover:bg-muted/30"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                      <FileText className="size-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.reportNumber} · {item.location}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        {parseCodeDispositions(item).map((pair, index) => (
                          <span
                            key={`${pair.code}-${index}`}
                            className="rounded bg-secondary px-2 py-1 text-secondary-foreground"
                          >
                            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                              Code {index + 1}
                            </span>{' '}
                            <span className="font-medium">{pair.code}</span>
                            <span className="mx-1 text-muted-foreground">→</span>
                            <span className="text-muted-foreground">
                              {pair.disposition}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`hidden rounded-full px-2 py-1 font-mono text-[10px] sm:block ${approvalBadgeClass[getApprovalStatus(item.approvalStatus)]}`}
                    >
                      {getApprovalStatus(item.approvalStatus)}
                    </span>

                    <span className="hidden rounded-full bg-accent px-2 py-1 font-mono text-[10px] text-accent-foreground sm:block">
                      {Number(item.violentFlag)
                        ? 'VIOLENT'
                        : Number(item.banBarFlag)
                          ? 'BAN / BAR'
                          : 'STANDARD'}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openIncidentEditor(item)}
                      disabled={!canCreateRecords(accessLevel)}
                    >
                      Edit
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openSupplementalEditor(item)}
                      disabled={!canCreateRecords(accessLevel)}
                    >
                      Supplement
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <Empty
                icon={<FileText />}
                text="No reports yet. Start with the facts."
                action={() => openIncidentEditor()}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border bg-muted/30 pb-4">
            <CardTitle className="text-base">
              Custody activity
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Evidence movement, logged live
            </p>
          </CardHeader>

          <CardContent className="p-0">
            {events.length ? (
              events.slice(0, 5).map(event => (
                <div
                  key={event.id}
                  className="flex gap-3 border-b border-border px-5 py-4 last:border-0"
                >
                  <div className="mt-1 size-2 shrink-0 rounded-full bg-primary ring-4 ring-primary/10" />

                  <div>
                    <p className="text-sm font-medium">
                      {event.action}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.actor} · {event.note || 'No note added'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <Empty
                icon={<Archive />}
                text="No custody events logged."
                action={() => setActivePanel('evidence')}
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div id="equipment" className="scroll-mt-6">
          <ActionCard
            icon={<Crosshair />}
            title="Equipment issue desk"
            description={`${equipment.length} assets tracked · ${availableEquipment} ready to issue`}
            action={canCreateRecords(accessLevel) ? 'Issue equipment' : 'Read only'}
            onClick={() =>
              canCreateRecords(accessLevel) &&
              setActivePanel('equipment')
            }
          >
            <div className="flex -space-x-2">
              {equipment.slice(0, 4).map(item => (
                <div
                  key={item.id}
                  className="flex size-8 items-center justify-center rounded-full border-2 border-card bg-secondary font-mono text-[10px] text-secondary-foreground"
                >
                  {item.name.slice(0, 1)}
                </div>
              ))}
            </div>
          </ActionCard>
        </div>

        <div id="evidence" className="scroll-mt-6">
          <ActionCard
            icon={<Users />}
            title="Evidence inventory"
            description={`${evidence.length} property items · chain of custody intact`}
            action={canCreateRecords(accessLevel) ? 'Log property' : 'Read only'}
            onClick={() =>
              canCreateRecords(accessLevel) &&
              setActivePanel('evidence')
            }
          >
            <div className="font-mono text-xs text-muted-foreground">
              AUDIT READY <span className="text-primary">●</span>
            </div>
          </ActionCard>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/30 pb-4">
            <div>
              <CardTitle className="text-base">Case files</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Manage cases and their related reports.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setActivePanel('case')}
              disabled={!canCreateRecords(accessLevel)}
            >
              <Plus className="size-3.5" />
              New case
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            {caseFiles.length ? (
              caseFiles.map(file => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {file.caseNumber} · {file.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {file.status} ·{' '}
                      {incidents.filter(item => item.caseFileId === file.id).length}{' '}
                      report(s)
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActivePanel('incident')}
                    disabled={!canCreateRecords(accessLevel)}
                  >
                    Add report
                  </Button>
                </div>
              ))
            ) : (
              <Empty
                icon={<ClipboardPlus />}
                text="No case files yet."
                action={() => setActivePanel('case')}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/30 pb-4">
            <div>
              <CardTitle className="text-base">
                Printable reports
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Print the incident register.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={printAllIncidents}
            >
              <FileText className="size-3.5" />
              Print all
            </Button>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              {incidents.length} report{incidents.length === 1 ? '' : 's'} ready to print.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="hidden print:block">
        <h1 className="mb-6 text-2xl font-bold">
          SafeGuard RMS — Incident Report Register
        </h1>

        {incidents.map(item => (
          <article
            key={item.id}
            className="mb-8 break-inside-avoid border-b border-foreground pb-5"
          >
            <h2 className="text-lg font-bold">
              {item.reportNumber}{' '}
              {item.reportType && item.reportType !== 'Original'
                ? `· ${item.reportType}`
                : ''}
            </h2>

            <p>
              Incident date: {item.incidentDate} · Location: {item.location},{' '}
              {item.city}, {item.state} {item.zipCode}
            </p>

            <p>
              Subject: {item.subjectName} · Flags:{' '}
              {Number(item.violentFlag) ? 'Violent ' : ''}
              {Number(item.banBarFlag) ? 'Ban / Bar' : 'None'}
            </p>

            <p>
              Codes / dispositions:{' '}
              {parseCodeDispositions(item)
                .map(pair => `${pair.code} — ${pair.disposition}`)
                .join('; ')}
            </p>

            <p className="mt-2 whitespace-pre-wrap">
              {item.narrative}
            </p>
          </article>
        ))}
      </section>
    </main>

{activePanel === 'review' &&
  reviewingIncident &&
  canApproveIncidents(accessLevel) && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">

        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">
              Incident Report Review
            </p>
            <h2 className="text-xl font-semibold">
              Report {reviewingIncident.reportNumber}
            </h2>
          </div>

          <Button
            variant="ghost"
            size="icon"
            disabled={reviewBusy}
            onClick={() => {
              setActivePanel(null)
              setReviewingIncident(null)
              setRejectionFeedback('')
            }}
            aria-label="Close review"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="grid gap-4 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">
              Incident Date
            </p>
            <p>{reviewingIncident.incidentDate}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Approval Status
            </p>
            <p>{reviewingIncident.approvalStatus}</p>
          </div>

          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">
              Location
            </p>
            <p>
              {reviewingIncident.location},{' '}
              {reviewingIncident.city},{' '}
              {reviewingIncident.state}{' '}
              {reviewingIncident.zipCode}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Subject
            </p>
            <p>{reviewingIncident.subjectName || 'Not provided'}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Report Type
            </p>
            <p>{reviewingIncident.reportType}</p>
          </div>

          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">
              Incident Codes / Dispositions
            </p>
            {parseCodeDispositions(reviewingIncident).map(
              (pair, index) => (
                <p key={index}>
                  {pair.code} — {pair.disposition}
                </p>
              ),
            )}
          </div>

          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-medium">
              Narrative
            </p>
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/30 p-4">
              {reviewingIncident.narrative}
            </div>
          </div>
        </div>

        {reviewingIncident.approvalStatus !== 'Approved' && (
          <div className="mt-5 space-y-3">
            <label
              htmlFor="rejection-feedback"
              className="text-sm font-medium"
            >
              Review Feedback
            </label>

            <textarea
              id="rejection-feedback"
              value={rejectionFeedback}
              onChange={event =>
                setRejectionFeedback(event.target.value)
              }
              placeholder="Explain required corrections if rejecting this report..."
              className="min-h-24 w-full rounded-md border border-input bg-transparent p-3 text-sm"
            />

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={reviewBusy}
                onClick={() =>
                  void decideIncident(
                    'Rejected',
                    rejectionFeedback,
                  )
                }
              >
                Reject Report
              </Button>

              <Button
                disabled={reviewBusy}
                onClick={() =>
                  void decideIncident(
                    'Approved',
                    rejectionFeedback,
                  )
                }
              >
                Approve Report
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )}

{activePanel && activePanel !== 'review' && (
  <Panel
    type={activePanel}
    userId={recordUserId}
    accessLevel={accessLevel}
    directoryUsers={directoryUsers}
    initialIncident={editingIncident}
    onClose={() => {
      setActivePanel(null)
      setEditingIncident(null)
    }}
    onSaved={() => {
      setActivePanel(null)
      setEditingIncident(null)
      window.location.reload()
    }}
  />
)}

<DevAccountSwitcher />
  
  {import.meta.env.DEV && (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        try {
          await reviewIncidentServer({
            data: {
              incidentId: 'INVALID-AUTHORIZATION-TEST-ID',
              decision: 'Approved',
              feedback: '',
            },
          })

          toast.error('SECURITY TEST FAILED', {
            description: 'Unauthorized approval was accepted.',
          })
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : String(error)

          if (message.includes('Insufficient permissions')) {
            toast.success('SECURITY TEST PASSED', {
              description:
                'The server denied approval for the User role.',
            })
          } else {
            toast.error('SECURITY TEST INCONCLUSIVE', {
              description: message,
            })
          }
        }
      }}
    >
      Test Approval Authorization
    </Button>
  )}

  </div>
)
}

function Metric({ icon, label, value, detail, accent }: { icon: ReactNode; label: string; value: string; detail: string; accent: string }) { return <Card className="relative overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"><div className={`absolute inset-y-0 left-0 w-1 ${accent}`} /><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><span className="text-muted-foreground">{icon}</span><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Live</span></div><p className="text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-sm font-medium">{label}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card> }
function Empty({ icon, text, action }: { icon: ReactNode; text: string; action: () => void }) { return <div className="flex flex-col items-center gap-3 px-5 py-12 text-center"><div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div><p className="text-sm text-muted-foreground">{text}</p><Button variant="outline" size="sm" onClick={action}>Get started</Button></div> }
function ActionCard({ icon, title, description, action, onClick, children }: { icon: ReactNode; title: string; description: string; action: string; onClick: () => void; children: ReactNode }) { return <Card className="flex items-center justify-between gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"><div className="flex min-w-0 items-center gap-4"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div><div className="min-w-0"><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 truncate text-xs text-muted-foreground">{description}</p></div></div><div className="hidden items-center gap-3 sm:flex">{children}<Button variant="outline" size="sm" onClick={onClick} disabled={action === 'Read only'}>{action}</Button></div><Button variant="outline" size="icon" className="sm:hidden" onClick={onClick} disabled={action === 'Read only'} aria-label={action}><ArrowUpRight className="size-4" /></Button></Card> }

function LoginGate() {
  const [busy, setBusy] = useState(false)

  const openSignIn = async () => {
    setBusy(true)

    try {
      const { error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/app',
      })

      if (error) {
        throw new Error(error.message || 'Google sign-in failed')
      }
    } catch (error) {
      console.error('Google sign-in error:', error)
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-primary px-5">
      <div className="w-full max-w-md rounded-2xl border border-border/30 bg-card p-8 text-card-foreground shadow-lg">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <ShieldCheck className="size-5" />
          </div>

          <div>
            <p className="font-semibold">SafeGuard RMS</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Secure operations
            </p>
          </div>
        </div>

        <h1 className="font-serif text-3xl">Sign in to command.</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Use the secure SafeGuard sign-in to access the records desk.
        </p>

        <Button
          className="mt-7 w-full"
          size="lg"
          onClick={openSignIn}
          disabled={busy}
        >
          {busy ? 'Opening secure sign-in…' : 'Continue to secure sign-in'}
          <ArrowUpRight className="size-4" />
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          OR
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* <Button
          className="w-full"
          size="lg"
          variant="outline"
          type="button"
          onClick={openSignIn}
          disabled={busy}
        >
          <span className="font-semibold">G</span>
          Continue with Google
        </Button> */}

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Email, password, account creation, and Google sign-in are handled securely.
        </p>

        {import.meta.env.DEV && (
          <DevAccountSwitcher />
        )}
      </div>
    </div>
  )
}

function Panel({
  type,
  userId,
  accessLevel,
  directoryUsers,
  initialIncident,
  onClose,
  onSaved,
}: {
  type: 'incident' | 'equipment' | 'evidence' | 'case'
  userId: string
  accessLevel: AccessLevel
  directoryUsers: {
    id: string
    email: string
    displayName?: string | null
  }[]
  initialIncident?: Incident | null
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const panelType:
  'incident' | 'equipment' | 'evidence' | 'case' = type
  const [availableEvidence, setAvailableEvidence] = useState<Evidence[]>([])
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([])
  const [form, setForm] = useState<Record<string, string>>(() => initialIncident ? {
    reportNumber: initialIncident.reportNumber, incidentDate: initialIncident.incidentDate, location: initialIncident.location,
    city: initialIncident.city || '', state: initialIncident.state || '', zipCode: initialIncident.zipCode || '',
    subjectName: initialIncident.subjectName, subjectPhone: initialIncident.subjectPhone || '', subjectDob: initialIncident.subjectDob || '',
    narrative: initialIncident.narrative,
    violentFlag: Number(initialIncident.violentFlag) ? '1' : '', banBarFlag: Number(initialIncident.banBarFlag) ? '1' : '',
    assignedTo: initialIncident.userId, caseFileId: initialIncident.caseFileId || '',
    clientId: initialIncident.clientId || '', siteId: initialIncident.siteId || '',
  } as Record<string, string> : { assignedTo: userId })
  const [organization, setOrganization] = useState<{
    clients: { id: string; name: string; status: string }[]
    sites: { id: string; clientId: string; name: string; status: string }[]
  }>({ clients: [], sites: [] })

  useEffect(() => {
    if (type !== 'incident') return
    let active = true
    getOrganizationStructure().then(result => {
      if (!active) return
      const clients = result.clients.filter(item => item.status === 'active')
      const sites = result.sites.filter(item => item.status === 'active')
      setOrganization({ clients, sites })
      if (!initialIncident) {
        const defaultClient = clients.length === 1 ? clients[0].id : ''
        const matchingSites = sites.filter(item => item.clientId === defaultClient)
        setForm(previous => ({
          ...previous,
          clientId: defaultClient,
          siteId: matchingSites.length === 1 ? matchingSites[0].id : '',
        }))
      }
    }).catch(() => toast.error('Could not load authorized clients and sites'))
    return () => { active = false }
  }, [type, initialIncident])

  const [caseTitle, setCaseTitle] = useState('')
  const [caseNumber, setCaseNumber] = useState('')
  const [codeDispositions, setCodeDispositions] = useState<CodeDisposition[]>(() => initialIncident ? parseCodeDispositions(initialIncident) : [{ code: '', disposition: '' }])
  
  useEffect(() => {
    if (type !== 'incident') return

    getPanelEvidence()
      .then(rows => {
        setAvailableEvidence(rows)

        setSelectedEvidenceIds(
          initialIncident
            ? rows
                .filter(
                  item => item.incidentId === initialIncident.id,
                )
                .map(item => item.id)
            : [],
        )
      })
      .catch((error: Error) =>
        toast.error('Could not load property items', {
          description: error.message,
        }),
      )
  }, [type, initialIncident])
  
  const toggleEvidence = (evidenceId: string) => setSelectedEvidenceIds(current => current.includes(evidenceId) ? current.filter(id => id !== evidenceId) : [...current, evidenceId])
  const updatePair = (index: number, key: keyof CodeDisposition, value: string) => setCodeDispositions(current => current.map((pair, pairIndex) => pairIndex === index ? { ...pair, [key]: value } : pair))
  const addPair = () => setCodeDispositions(current => [...current, { code: '', disposition: '' }])
  const removePair = (index: number) => setCodeDispositions(current => current.length === 1 ? current : current.filter((_, pairIndex) => pairIndex !== index))
  const update = (key: string) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(prev => ({ ...prev, [key]: e.target.value }))
  
const requiredFieldKeys: Record<
  'incident' | 'equipment' | 'evidence' | 'case',
  string[]
> = {
  incident: [
    'location',
    'city',
    'state',
    'zipCode',
    'subjectName',
    'narrative',
  ],
  equipment: [
    'name',
    'serialNumber',
  ],
  evidence: [
    'itemNumber',
    'description',
    'location',
  ],
  case: [],
}

const field = (
  label: string,
  key: string,
  placeholder = '',
  inputType = 'text',
) => {
  const required = requiredFieldKeys[panelType].includes(key)

  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium">
        {label}
        {required && (
          <span
            className="ml-1 text-red-500"
            aria-hidden="true"
          >
            *
          </span>
        )}
      </span>

      <Input
        type={inputType}
        placeholder={placeholder}
        value={form[key] || ''}
        onChange={update(key)}
        required={required}
        aria-required={required}
      />
    </label>
  )
}

  const equipmentAssignment = type === 'equipment' ? <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-medium">Assign to user</span><select className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring" value={form.assignedTo || userId} onChange={update('assignedTo')}><option value={userId}>Myself</option>{directoryUsers.filter(item => item.id !== userId).map(item => <option key={item.id} value={item.id}>{item.displayName || item.email}</option>)}</select></label> : null
    const save = async () => {
      if (!canCreateRecords(accessLevel)) {
        toast.error('Read-only access', {
          description:
            'Support users can review records but cannot create them.',
        })
        return
      }

      if (type === 'case') {
        if (!caseNumber.trim() || !caseTitle.trim()) {
          toast.error('Complete the case fields', {
            description:
              'Case number and title are required.',
          })
          return
        }

        setSaving(true)

        try {
          await createCaseFile({
            data: {
              caseNumber: caseNumber.trim(),
              title: caseTitle.trim(),
            },
          })

          toast.success('Case file created')
          onSaved()
        } catch (error) {
          toast.error('Could not save case file', {
            description:
              error instanceof Error
                ? error.message
                : 'Please try again.',
          })
        } finally {
          setSaving(false)
        }

        return
      }

      const requiredFields =
        type === 'incident'
          ? [
              ['location', 'Location'],
              ['city', 'City'],
              ['state', 'State'],
              ['zipCode', 'ZIP code'],
              ['subjectName', 'Subject name'],
              ['narrative', 'Narrative'],
            ]
          : type === 'equipment'
            ? [
                ['name', 'Equipment name'],
                ['serialNumber', 'Serial number'],
              ]
            : [
                ['itemNumber', 'Item number'],
                ['description', 'Description'],
                ['location', 'Found / stored location'],
              ]

      const missingField = requiredFields.find(
        ([key]) => !form[key]?.trim(),
      )

      if (missingField) {
        const missingFieldLabel = missingField[1]

        toast.error('Complete the required fields', {
          description: `${missingFieldLabel} is required before saving.`,
        })

        return
      }

      const completedPairs = codeDispositions
        .map(pair => ({
          code: pair.code.trim(),
          disposition: pair.disposition.trim(),
        }))
        .filter(pair => pair.code || pair.disposition)

      if (
        type === 'incident' &&
        (
          completedPairs.length === 0 ||
          completedPairs.some(
            pair => !pair.code || !pair.disposition,
          )
        )
      ) {
        toast.error('Complete the code and disposition pairs', {
          description:
            'Each incident code must have its corresponding disposition.',
        })
        return
      }

      setSaving(true)

      try {
        const now = new Date().toISOString()

        if (type === 'incident') {
          const baseReportNumber =
            form.reportNumber?.trim() ||
            `SG-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`

          const savedIncident = await saveIncident({
            data: {
              id: initialIncident?.id || null,
              reportNumber: baseReportNumber,
              incidentDate:
                form.incidentDate || now.slice(0, 10),
              location: form.location.trim(),
              city: form.city.trim(),
              state: form.state.trim().toUpperCase(),
              zipCode: form.zipCode.trim(),
              subjectName: form.subjectName.trim(),
              subjectPhone:
                form.subjectPhone?.trim() || null,
              subjectDob:
                form.subjectDob?.trim() || null,
              violentFlag: form.violentFlag ? 1 : 0,
              banBarFlag: form.banBarFlag ? 1 : 0,
              incidentCodes: JSON.stringify(
                completedPairs.map(pair => pair.code),
              ),
              disposition:
                JSON.stringify(completedPairs),
              narrative: form.narrative.trim(),
              approvalStatus:
                initialIncident?.approvalStatus === 'Rejected'
                  ? 'Pending'
                  : initialIncident?.approvalStatus || 'Pending',
              reviewFeedback:
                initialIncident?.approvalStatus === 'Rejected'
                  ? null
                  : initialIncident?.reviewFeedback || null,
              reviewedBy:
                initialIncident?.approvalStatus === 'Rejected'
                  ? null
                  : initialIncident?.reviewedBy || null,
              reviewedAt:
                initialIncident?.approvalStatus === 'Rejected'
                  ? null
                  : initialIncident?.reviewedAt || null,
              createdAt:
                initialIncident?.createdAt || now,
              caseFileId:
                form.caseFileId || null,
              clientId: form.clientId || null,
              siteId: form.siteId || null,
              parentIncidentId:
                initialIncident?.parentIncidentId || null,
              reportType:
                initialIncident?.reportType || 'Original',
            },
          })

          const incidentId = savedIncident.id

          await Promise.all(
            availableEvidence
              .filter(
                item =>
                  item.incidentId === incidentId &&
                  !selectedEvidenceIds.includes(item.id),
              )
              .map(item =>
                updateEvidenceIncident({
                  data: {
                    evidenceId: item.id,
                    incidentId: null,
                  },
                }),
              ),
          )

          await Promise.all(
            selectedEvidenceIds.map(id =>
              updateEvidenceIncident({
                data: {
                  evidenceId: id,
                  incidentId,
                },
              }),
            ),
          )
        }

        if (type === 'equipment') {
          await createEquipment({
            data: {
              name: form.name.trim(),
              serialNumber: form.serialNumber.trim(),
              assignedTo: form.assignedTo || userId,
            },
          })
        }

        if (type === 'evidence') {
          await createEvidence({
            data: {
              itemNumber: form.itemNumber.trim(),
              description: form.description.trim(),
              location: form.location.trim(),
            },
          })
        }

        toast.success(
          type === 'incident'
            ? 'Report submitted for supervisor approval'
            : type === 'equipment'
              ? 'Equipment added'
              : 'Evidence logged',
        )

        onSaved()
      } catch (error) {
        toast.error('Could not save record', {
          description:
            error instanceof Error
              ? error.message
              : 'Please try again.',
        })
      } finally {
        setSaving(false)
      }
    }

  const renderType = type as
    | 'incident'
    | 'equipment'
    | 'evidence'
    | 'case'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-lg sm:rounded-2xl sm:p-7">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              Secure data entry · {ACCESS_LABELS[accessLevel]}
            </p>

            <h2 className="mt-1 font-serif text-2xl">
              {renderType === 'case'
                ? 'New case file'
                : renderType === 'incident'
                  ? initialIncident
                    ? 'Edit incident report'
                    : 'New incident report'
                  : renderType === 'equipment'
                    ? 'Add equipment asset'
                    : 'Log property / evidence'}
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {renderType === 'case'
                ? 'Create a case file to organize related incident reports.'
                : renderType === 'incident'
                  ? 'Capture the facts, flags, codes, disposition, and narrative in one review-ready record.'
                  : 'Fields marked with an asterisk (*) are required.'}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Form */}
        <div className="grid gap-4 sm:grid-cols-2">

          
          {renderType === 'case' ? (
            <>
              <div className="space-y-1.5 sm:col-span-2">
                <label
                  htmlFor="case-number"
                  className="text-xs font-medium"
                >
                  Case Number
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <Input
                  id="case-number"
                  placeholder="CASE-2026-0001"
                  value={caseNumber}
                  onChange={event => setCaseNumber(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label
                  htmlFor="case-title"
                  className="text-xs font-medium"
                >
                  Case Title
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <Input
                  id="case-title"
                  placeholder="Burglary investigation"
                  value={caseTitle}
                  onChange={event => setCaseTitle(event.target.value)}
                  required
                />
              </div>
            </>

          ) : renderType === 'incident' ? (
            <>
              {/* Incident identification */}
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                {field(
                  'Report number',
                  'reportNumber',
                  'Auto-generated if blank'
                )}

                {field(
                  'Incident date',
                  'incidentDate',
                  '',
                  'date'
                )}
              </div>

              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Client (optional)
                  <select
                    className="mt-2 w-full rounded-md border border-input bg-background p-2"
                    value={form.clientId || ''}
                    disabled={Boolean(initialIncident?.parentIncidentId)}
                    onChange={event => setForm(previous => ({
                      ...previous, clientId: event.target.value, siteId: '',
                    }))}
                  >
                    <option value="">Not assigned</option>
                    {organization.clients.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Site (optional)
                  <select
                    className="mt-2 w-full rounded-md border border-input bg-background p-2"
                    value={form.siteId || ''}
                    disabled={!form.clientId || Boolean(initialIncident?.parentIncidentId)}
                    onChange={event => setForm(previous => ({
                      ...previous, siteId: event.target.value,
                    }))}
                  >
                    <option value="">Not assigned</option>
                    {organization.sites.filter(item => item.clientId === form.clientId).map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Incident location */}
              {field('Location', 'location', '123 Main St / sector 4')}
              {field('City', 'city', 'Springfield')}
              {field('State', 'state', 'CA')}
              {field('ZIP code', 'zipCode', '90210')}

              {/* Subject information */}
              {field('Subject name', 'subjectName', 'Full legal name')}

              {field(
                'Contact phone',
                'subjectPhone',
                '(555) 000-0000',
                'tel'
              )}

              {field(
                'Date of birth',
                'subjectDob',
                'MM / DD / YYYY'
              )}

              {/* Incident flags */}
              <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2 sm:grid-cols-2">
                <p className="text-xs font-medium sm:col-span-2">
                  Report flags
                </p>

                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.violentFlag === '1'}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        violentFlag: event.target.checked ? '1' : '',
                      }))
                    }
                    className="size-4 accent-primary"
                  />
                  Violent subject / incident
                </label>

                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.banBarFlag === '1'}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        banBarFlag: event.target.checked ? '1' : '',
                      }))
                    }
                    className="size-4 accent-primary"
                  />
                  Ban / bar flag
                </label>
              </div>

              {/* Incident codes and dispositions */}
              <div className="space-y-3 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium">
                      Incident codes and dispositions
                      <span className="ml-1 text-red-500">*</span>
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Pair every incident code with its disposition.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPair}
                  >
                    <Plus className="size-3.5" />
                    Add pair
                  </Button>
                </div>

                {codeDispositions.map((pair, index) => (
                  <div
                    key={`pair-${index}`}
                    className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-[1fr_1.4fr_auto]"
                  >
                    {/* Incident code */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">
                        Incident Code
                        <span className="ml-1 text-red-500">*</span>
                      </label>

                      <Input
                        value={pair.code}
                        onChange={event =>
                          updatePair(index, 'code', event.target.value)
                        }
                        placeholder="e.g. 240"
                        aria-label={`Incident code ${index + 1}`}
                        required
                      />
                    </div>

                    {/* Disposition */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">
                        Disposition
                        <span className="ml-1 text-red-500">*</span>
                      </label>

                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={pair.disposition}
                        onChange={event =>
                          updatePair(
                            index,
                            'disposition',
                            event.target.value
                          )
                        }
                        aria-label={`Disposition for code ${index + 1}`}
                        required
                      >
                        <option value="">
                          Select disposition
                        </option>

                        {pair.disposition &&
                          !DISPOSITIONS.some(
                            option => option === pair.disposition
                          ) && (
                            <option value={pair.disposition}>
                              {pair.disposition} (Legacy)
                            </option>
                          )}

                        {DISPOSITIONS.map(disposition => (
                          <option
                            key={disposition}
                            value={disposition}
                          >
                            {disposition}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Remove code/disposition pair */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="self-end"
                      onClick={() => removePair(index)}
                      disabled={codeDispositions.length === 1}
                      aria-label={`Remove code ${index + 1}`}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Associated evidence */}
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2">
                <div>
                  <p className="text-xs font-medium">
                    Associated property / evidence
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Select one or more items tied to this report.
                  </p>
                </div>

                {availableEvidence.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {availableEvidence.map(item => (
                      <label
                        key={item.id}
                        className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 text-sm transition-colors hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvidenceIds.includes(item.id)}
                          onChange={() => toggleEvidence(item.id)}
                          className="mt-0.5 size-4 accent-primary"
                        />

                        <span className="min-w-0">
                          <span className="block font-medium">
                            {item.itemNumber}
                          </span>

                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {item.description} · {item.location}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No property items yet. Log property first,
                    then associate it here.
                  </p>
                )}
              </div>

              {/* Narrative */}
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-medium">
                  Narrative
                  <span className="ml-1 text-red-500">*</span>
                </span>

                <textarea
                  className="min-h-36 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none ring-ring focus-visible:ring-[3px]"
                  placeholder="Document the facts, sequence, witnesses, and actions taken…"
                  value={form.narrative || ''}
                  onChange={update('narrative')}
                  required
                  aria-required="true"
                />
              </label>
            </>
          ) : renderType === 'equipment' ? (
            <>
              {field(
                'Equipment name',
                'name',
                'Body camera / radio / kit'
              )}

              {field(
                'Serial number',
                'serialNumber',
                'Asset identifier'
              )}

              {equipmentAssignment}
            </>
          ) : (
            <>
              {field(
                'Item number',
                'itemNumber',
                'EV-2026-0001'
              )}

              {field(
                'Description',
                'description',
                'Describe the item and packaging'
              )}

              {field(
                'Found / stored location',
                'location',
                'Evidence locker / room'
              )}
            </>
          )}
        </div>

        {/* Form actions */}
        <div className="mt-7 flex justify-end gap-2 border-t border-border pt-5">
          <Button
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            onClick={save}
            disabled={saving}
          >
            {saving
              ? 'Saving…'
              : initialIncident && type === 'incident'
                ? 'Update report'
                : 'Save securely'}

            <ArrowUpRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
