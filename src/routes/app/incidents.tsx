import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getDashboardData } from '@/lib/dashboard.functions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/app/incidents')({ component: DirectoryPage })
type Row = Awaited<ReturnType<typeof getDashboardData>>['incidents'][number]

function DirectoryPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getDashboardData().then(data => { if (active) setRows(data.incidents) }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : 'Unable to load records')
    })
    return () => { active = false }
  }, [])
  return <main className="mx-auto max-w-6xl space-y-5 p-6">
    <style>{`@media print { body * { visibility: hidden !important; } #incident-print, #incident-print * { visibility: visible !important; } #incident-print { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; } .no-print { display: none !important; } }`}</style>
    <div className="no-print flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Incident Reports</h1>{selected && <Button variant="outline" onClick={() => setSelected(null)}>Back to reports</Button>}</div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {selected ? <>
      <div className="no-print flex justify-end"><Button onClick={() => window.print()}>Print report / Save as PDF</Button></div>
      <Card id="incident-print"><CardHeader><CardTitle>Incident Report {selected.reportNumber}</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <p><strong>Date:</strong> {selected.incidentDate}</p><p><strong>Status:</strong> {selected.approvalStatus}</p>
            <p><strong>Location:</strong> {selected.location}</p><p><strong>City/State:</strong> {selected.city}, {selected.state} {selected.zipCode}</p>
            <p><strong>Subject:</strong> {selected.subjectName}</p><p><strong>Type:</strong> {selected.reportType}</p>
            <p><strong>Codes:</strong> {selected.incidentCodes}</p><p><strong>Disposition:</strong> {selected.disposition}</p>
          </div>
          <section><h2 className="mb-2 font-semibold">Narrative</h2><p className="whitespace-pre-wrap">{selected.narrative}</p></section>
          {selected.reviewFeedback && <section><h2 className="mb-2 font-semibold">Review feedback</h2><p className="whitespace-pre-wrap">{selected.reviewFeedback}</p></section>}
        </CardContent></Card>
    </> : <Card className="no-print"><CardHeader><CardTitle>Records ({rows.length})</CardTitle></CardHeader><CardContent className="space-y-3">
      <Input aria-label="Search records" placeholder="Search records" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[750px] text-sm"><thead className="bg-muted/50"><tr><th className="px-3 py-2 text-left font-medium" scope="col">Report #</th><th className="px-3 py-2 text-left font-medium" scope="col">Date</th><th className="px-3 py-2 text-left font-medium" scope="col">Location</th><th className="px-3 py-2 text-left font-medium" scope="col">Status</th><th className="px-3 py-2 text-left font-medium" scope="col">Actions</th></tr></thead><tbody>
        {rows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())).map(row => <tr key={row.id} className="border-t"><td className="px-3 py-3 align-middle">{row.reportNumber}</td><td className="px-3 py-3 align-middle">{row.incidentDate}</td><td className="px-3 py-3 align-middle">{row.location}</td><td className="px-3 py-3 align-middle">{row.approvalStatus}</td><td className="px-3 py-3 align-middle"><Button size="sm" variant="outline" onClick={() => setSelected(row)}>Inspect / Print</Button></td></tr>)}
      </tbody></table></div>
    </CardContent></Card>}
  </main>
}
