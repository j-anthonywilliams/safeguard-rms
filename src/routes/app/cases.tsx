import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getDashboardData, getCaseNotes, addCaseNote, assignIncidentToCaseFile } from '@/lib/dashboard.functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export const Route = createFileRoute('/app/cases')({ component: CaseFilesPage })
type Data = Awaited<ReturnType<typeof getDashboardData>>
type CaseNote = Awaited<ReturnType<typeof getCaseNotes>>[number]

function CaseFilesPage() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<CaseNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [reportId, setReportId] = useState('')
  const [busy, setBusy] = useState(false)
  const reload = async () => setData(await getDashboardData())
  useEffect(() => { void reload().catch(e => setError(e instanceof Error ? e.message : 'Unable to load case files')) }, [])
  useEffect(() => {
    if (!selectedId) return
    let active = true
    getCaseNotes({ data: { caseFileId: selectedId } }).then(result => { if (active) setNotes(result) }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unable to load notes') })
    return () => { active = false }
  }, [selectedId])
  const file = data?.caseFiles.find(c => c.id === selectedId)
  const linked = data?.incidents.filter(i => i.caseFileId === selectedId) ?? []
  const canManage = data ? ['user', 'supervisor', 'investigator', 'admin', 'backend'].includes(data.accessLevel) : false
  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try { await operation(); await reload(); toast.success(success) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Action failed') }
    finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-6xl space-y-5 p-6">
    <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Case Files</h1>{selectedId && <Button variant="outline" onClick={() => setSelectedId(null)}>Back to cases</Button>}</div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {file ? <>
      <Card><CardHeader><CardTitle>{file.caseNumber} - {file.title}</CardTitle></CardHeader><CardContent className="text-sm">{file.status} · Lead: {file.leadOfficer || 'Unassigned'}</CardContent></Card>
      <Card><CardHeader><CardTitle>Case Notes</CardTitle></CardHeader><CardContent className="space-y-3">
        {notes.map(n => <div key={n.id} className="border-b pb-2"><p className="whitespace-pre-wrap">{n.note}</p><p className="text-xs text-muted-foreground">{data?.directoryUsers.find(u => u.id === n.authorId)?.displayName || n.authorId} · {n.createdAt}</p></div>)}
        {!notes.length && <p className="text-muted-foreground">No notes yet.</p>}
        {canManage && <><textarea className="w-full rounded-md border bg-background p-2" rows={3} maxLength={10000} value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add case note"/><Button disabled={busy || !newNote.trim()} onClick={() => void run(async () => { await addCaseNote({ data: { caseFileId: file.id, note: newNote } }); setNotes(await getCaseNotes({ data: { caseFileId: file.id } })); setNewNote('') }, 'Note saved')}>Save note</Button></>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Associated Reports ({linked.length})</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Report</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Actions</th></tr></thead><tbody>{linked.map(i => <tr key={i.id} className="border-t"><td className="p-2">{i.reportNumber}</td><td className="p-2">{i.approvalStatus}</td><td className="p-2"><div className="flex gap-2"><a className="rounded-md border px-3 py-1" href="/app/incidents">Open reports</a>{canManage && !i.parentIncidentId && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => assignIncidentToCaseFile({ data: { incidentId: i.id, caseFileId: null } }), 'Report removed')}>Remove</Button>}</div></td></tr>)}</tbody></table></div>
        {canManage && <div className="flex flex-wrap gap-2"><select aria-label="Report to associate" className="rounded-md border bg-background p-2" value={reportId} onChange={e => setReportId(e.target.value)}><option value="">Select report</option>{data?.incidents.filter(i => !i.parentIncidentId && i.caseFileId !== file.id).map(i => <option key={i.id} value={i.id}>{i.reportNumber}</option>)}</select><Button disabled={!reportId || busy} onClick={() => void run(async () => { await assignIncidentToCaseFile({ data: { incidentId: reportId, caseFileId: file.id } }); setReportId('') }, 'Report added')}>Add report</Button></div>}
      </CardContent></Card>
    </> : <Card><CardHeader><CardTitle>Case Directory ({data?.caseFiles.length ?? 0})</CardTitle></CardHeader><CardContent className="space-y-3">
      <Input placeholder="Search case files" aria-label="Search case files" value={search} onChange={e => setSearch(e.target.value)}/>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Case #</th><th className="p-2 text-left">Title</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Reports</th><th className="p-2 text-left">Action</th></tr></thead><tbody>{data?.caseFiles.filter(c => `${c.caseNumber} ${c.title}`.toLowerCase().includes(search.toLowerCase())).map(c => <tr key={c.id} className="border-t"><td className="p-2">{c.caseNumber}</td><td className="p-2">{c.title}</td><td className="p-2">{c.status}</td><td className="p-2">{data.incidents.filter(i => i.caseFileId === c.id).map(i => i.reportNumber).join(', ') || 'None'}</td><td className="p-2"><Button size="sm" variant="outline" onClick={() => { setSelectedId(c.id); setNewNote(''); setReportId('') }}>Open Case File</Button></td></tr>)}</tbody></table></div>
    </CardContent></Card>}
  </main>
}
