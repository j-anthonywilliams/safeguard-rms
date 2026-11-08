import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getDashboardData } from '@/lib/dashboard.functions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { transactEquipment, listEquipmentTransactions, listEquipmentEmployees } from '@/lib/equipment-transactions.functions'

export const Route = createFileRoute('/app/equipment')({ component: DirectoryPage })

type Row = Awaited<ReturnType<typeof getDashboardData>>['equipment'][number]
function DirectoryPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [action,setAction]=useState<'issue'|'return'>('issue')
  const [equipmentId,setEquipmentId]=useState('')
  const [employeeId,setEmployeeId]=useState('')
  const [note,setNote]=useState('')
  const [showTransaction,setShowTransaction]=useState(false)
  const [busy,setBusy]=useState(false)
  const [employees,setEmployees]=useState<Awaited<ReturnType<typeof listEquipmentEmployees>>>([])
  const [history,setHistory]=useState<Awaited<ReturnType<typeof listEquipmentTransactions>>>([])
  const reload=async()=>{const data=await getDashboardData();setRows(data.equipment);setHistory(await listEquipmentTransactions());setEmployees(await listEquipmentEmployees())}
  useEffect(() => {
    let active = true
    Promise.all([getDashboardData(),listEquipmentTransactions(),listEquipmentEmployees()]).then(([data,transactions,people]) => { if (active){setRows(data.equipment);setHistory(transactions);setEmployees(people)} }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : 'Unable to load records')
    })
    return () => { active = false }
  }, [])
  return <main className="mx-auto max-w-5xl space-y-5 p-6">
    <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Equipment Desk</h1><Button onClick={()=>setShowTransaction(v=>!v)}>Issue / Return Equipment</Button></div>
    {showTransaction&&<Card><CardHeader><CardTitle>Equipment Transaction</CardTitle></CardHeader><CardContent className="space-y-3"><select className="w-full rounded border bg-background p-2" value={action} onChange={e=>{setAction(e.target.value as 'issue'|'return');setEquipmentId('')}}><option value="issue">Issue</option><option value="return">Return</option></select><select aria-label="Equipment" className="w-full rounded border bg-background p-2" value={equipmentId} onChange={e=>setEquipmentId(e.target.value)}><option value="">Select equipment</option>{rows.filter(r=>action==='issue'?r.status==='Available':r.status==='Issued').map(r=><option key={r.id} value={r.id}>{r.name} · {r.serialNumber}</option>)}</select>{action==='issue'&&<select aria-label="Employee" className="w-full rounded border bg-background p-2" value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Select employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.displayName||e.email} ({e.email})</option>)}</select>}<Input placeholder="Condition / transaction notes" value={note} onChange={e=>setNote(e.target.value)}/><Button disabled={busy||!equipmentId||(action==='issue'&&!employeeId.trim())} onClick={async()=>{setBusy(true);try{await transactEquipment({data:{equipmentId,action,employeeId,conditionNote:note}});await reload();setEquipmentId('');setEmployeeId('');setNote('');setShowTransaction(false);setError('')}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}}>Confirm {action==='issue'?'Issue':'Return'}</Button></CardContent></Card>}

    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Card><CardHeader><CardTitle>Records ({rows.length})</CardTitle></CardHeader><CardContent className="space-y-3">
      <Input aria-label="Search records" placeholder="Search records" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/50"><tr><th className="px-3 py-2 text-left font-medium" scope="col">Equipment</th><th className="px-3 py-2 text-left font-medium" scope="col">Serial Number</th><th className="px-3 py-2 text-left font-medium" scope="col">Status</th><th className="px-3 py-2 text-left font-medium" scope="col">Assigned To</th></tr></thead><tbody>
        {rows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())).map(row => <tr key={row.id} className="border-t"><td className="px-3 py-3 align-middle">{row.name}</td><td className="px-3 py-3 align-middle">{row.serialNumber}</td><td className="px-3 py-3 align-middle">{row.status}</td><td className="px-3 py-3 align-middle">{row.assignedTo || "Unassigned"}</td></tr>)}
      </tbody></table></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Recent Issue / Return Activity</CardTitle></CardHeader><CardContent>{history.map(h=><p key={h.id} className="border-b py-2 text-sm">{h.action} · {rows.find(r=>r.id===h.equipmentId)?.name||h.equipmentId} · {h.createdAt} · {h.conditionNote}</p>)}</CardContent></Card>
  </main>
}
