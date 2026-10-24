import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/app/training-preview')({ component: TrainingPreview })
const initial = [
  { id: 'DEMO-101', name: 'Alex Morgan', role: 'Officer', course: 'Orientation & Policy Review', status: 'Complete', progress: 100 },
  { id: 'DEMO-102', name: 'Jordan Lee', role: 'Investigator', course: 'Evidence Handling', status: 'In Progress', progress: 65 },
  { id: 'DEMO-103', name: 'Taylor Reed', role: 'Office Staff', course: 'Records & Confidentiality', status: 'Not Started', progress: 0 },
]
function TrainingPreview() {
  const [rows, setRows] = useState(initial)
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const current = rows.find(row => row.id === selected)
  return <main className="mx-auto max-w-6xl space-y-5 p-6">
    <div><h1 className="text-2xl font-semibold">Training & Onboarding</h1><p className="text-sm text-muted-foreground">Interactive demonstration · Sample records only · Nothing is saved to the database</p></div>
    <div className="grid gap-3 md:grid-cols-3">{[
      ['Assigned employees', rows.length], ['Completed courses', rows.filter(r => r.status === 'Complete').length], ['Pending or in progress', rows.filter(r => r.status !== 'Complete').length],
    ].map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="text-3xl font-semibold">{value}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Employee Training Directory</CardTitle></CardHeader><CardContent className="space-y-3">
      <input className="w-full rounded-md border bg-background px-3 py-2 text-sm" aria-label="Search training" placeholder="Search employees or courses" value={search} onChange={e => setSearch(e.target.value)}/>
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="bg-muted/50"><tr>{['Employee','Role','Assigned Course','Status','Progress','Action'].map(h => <th scope="col" key={h} className="p-3 text-left">{h}</th>)}</tr></thead><tbody>{rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase())).map(r => <tr key={r.id} className="border-t"><td className="p-3">{r.name}</td><td className="p-3">{r.role}</td><td className="p-3">{r.course}</td><td className="p-3">{r.status}</td><td className="p-3">{r.progress}%</td><td className="p-3"><Button size="sm" variant="outline" onClick={() => setSelected(r.id)}>Inspect</Button></td></tr>)}</tbody></table></div>
    </CardContent></Card>
    {current && <Card><CardHeader><CardTitle>Training Record — {current.name}</CardTitle></CardHeader><CardContent className="space-y-3"><p><strong>Course:</strong> {current.course}</p><p><strong>Status:</strong> {current.status}</p><p><strong>Completion:</strong> {current.progress}%</p><div className="flex flex-wrap gap-2"><Button onClick={() => setRows(prev => prev.map(r => r.id === current.id ? {...r, status: 'Complete', progress: 100} : r))}>Mark Complete (Demo)</Button><Button variant="outline" onClick={() => setSelected(null)}>Close</Button><Button variant="outline" onClick={() => setRows(initial)}>Reset Demo</Button></div></CardContent></Card>}
  </main>
}
