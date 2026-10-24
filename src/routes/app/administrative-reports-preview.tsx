import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/app/administrative-reports-preview')({ component: AdministrativePreview })
type Status = 'Draft' | 'Submitted' | 'Supervisor Review' | 'Manager Review' | 'Approved' | 'Returned'
const initial: {id:string; employee:string; category:string; status:Status; narrative:string}[] = [
  {id:'DEMO-AR-001', employee:'Alex Morgan', category:'Use of Force', status:'Supervisor Review', narrative:'Demonstration narrative. No actual incident data.'},
  {id:'DEMO-AR-002', employee:'Jordan Lee', category:'Property Damage', status:'Draft', narrative:'Demonstration administrative report.'},
]
function AdministrativePreview() {
 const [records, setRecords] = useState(initial)
 const [active, setActive] = useState<string | null>(null)
 const [note, setNote] = useState('')
 const [newCategory, setNewCategory] = useState('General Administrative')
 const record = records.find(r => r.id === active)
 const setStatus = (status:Status) => {setRecords(prev => prev.map(r => r.id === active ? {...r,status} : r));setNote('')}
 return <main className="mx-auto max-w-6xl space-y-5 p-6">
   <div><h1 className="text-2xl font-semibold">Administrative Reporting</h1><p className="text-sm text-muted-foreground">Interactive workflow preview · Inspired by the Chief’s Report format · Demo data only</p></div>
   <Card><CardHeader><CardTitle>Report Directory</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2"><select aria-label="Report type" className="rounded-md border bg-background px-3 py-2 text-sm" value={newCategory} onChange={e => setNewCategory(e.target.value)}>{['General Administrative','Use of Force','Property Damage','Employee Injury','Other'].map(v => <option key={v}>{v}</option>)}</select><Button onClick={() => {const id=`DEMO-AR-${String(records.length+1).padStart(3,'0')}`;setRecords(prev=>[...prev,{id,employee:'Demo Employee',category:newCategory,status:'Draft',narrative:''}]);setActive(id)}}>Create Demo Report</Button></div>
   <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="bg-muted/50"><tr>{['Report','Employee','Type','Workflow Status','Action'].map(h=><th scope="col" className="p-3 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{records.map(r=><tr className="border-t" key={r.id}><td className="p-3">{r.id}</td><td className="p-3">{r.employee}</td><td className="p-3">{r.category}</td><td className="p-3">{r.status}</td><td className="p-3"><Button size="sm" variant="outline" onClick={()=>setActive(r.id)}>Inspect</Button></td></tr>)}</tbody></table></div></CardContent></Card>
   {record && <Card><CardHeader><CardTitle>{record.id} — {record.category}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm">Employee: {record.employee} · Status: {record.status}</p><div><label htmlFor="demo-narrative" className="text-sm font-medium">Incident narrative / recommendations</label><textarea id="demo-narrative" rows={4} className="mt-1 w-full rounded-md border bg-background p-3 text-sm" value={record.narrative} onChange={e=>setRecords(prev=>prev.map(r=>r.id===record.id?{...r,narrative:e.target.value}:r))}/></div><div><label htmlFor="demo-review" className="text-sm font-medium">Reviewer notes</label><textarea id="demo-review" rows={2} className="mt-1 w-full rounded-md border bg-background p-3 text-sm" value={note} onChange={e=>setNote(e.target.value)}/></div><div className="flex flex-wrap gap-2"><Button onClick={()=>setStatus('Submitted')}>Submit</Button><Button variant="outline" onClick={()=>setStatus('Supervisor Review')}>Supervisor Review</Button><Button variant="outline" onClick={()=>setStatus('Manager Review')}>Manager Review</Button><Button variant="outline" onClick={()=>setStatus('Approved')}>Approve</Button><Button variant="outline" onClick={()=>setStatus('Returned')}>Return</Button><Button variant="outline" onClick={()=>setActive(null)}>Close</Button></div><p className="text-xs text-muted-foreground">Buttons simulate workflow transitions only; no approval authority or data persistence is applied in this preview.</p></CardContent></Card>}
   </main>
}
