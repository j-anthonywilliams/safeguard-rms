import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ClientBoundary } from '@/components/ClientBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listLogRecords, saveLogRecord, type LogRecord } from '@/lib/record-logs.functions'
import { toast } from 'sonner'

export const Route = createFileRoute('/app/property')({ component: () => <ClientBoundary fallback={<div className="p-6">Loading...</div>}><LogScreen /></ClientBoundary> })
function LogScreen() {
  const [records, setRecords] = useState<LogRecord[]>([])
  const [selected, setSelected] = useState<LogRecord | null>(null)
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [itemNumber, setItemNumber] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const reload = async () => { try { setRecords(await listLogRecords({data:{kind: 'property'}})) } catch(e) { setError(e instanceof Error ? e.message : 'Unable to load records') } }
  useEffect(() => { void reload() }, [])
  const open = (record: LogRecord, edit: boolean) => { setSelected(record); setCreating(false); setEditing(edit); setItemNumber(record.itemNumber); setDescription(record.description); setLocation(record.location) }
  const save = async () => { setBusy(true); try { await saveLogRecord({data:{kind:'property',id:creating?null:selected?.id??null,itemNumber,description,location}}); toast.success('Record saved'); setSelected(null); setEditing(false); setCreating(false); await reload() } catch(e) { toast.error(e instanceof Error?e.message:'Unable to save') } finally { setBusy(false) } }
  return <main className="mx-auto max-w-5xl space-y-5 p-6">
    <a className="text-sm underline" href="/app">Back to Command Center</a>
    <h1 className="text-2xl font-semibold">Property Log</h1>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {selected || creating ? <Card><CardHeader><CardTitle>{creating?'New record':selected?.itemNumber}</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="flex gap-2"><Button variant="outline" onClick={()=>{setSelected(null);setEditing(false);setCreating(false)}}>Back to log</Button>{!editing&&!creating&&<Button onClick={()=>setEditing(true)}>Edit</Button>}</div>
      <label className="block text-sm">Item number<Input value={itemNumber} disabled={!creating} onChange={e=>setItemNumber(e.target.value)} /></label>
      <label className="block text-sm">Description<textarea className="w-full rounded-md border bg-background p-2" value={description} disabled={!editing&&!creating} onChange={e=>setDescription(e.target.value)} rows={5}/></label>
      <label className="block text-sm">Location<Input value={location} disabled={!editing&&!creating} onChange={e=>setLocation(e.target.value)}/></label>
      {selected&&<p className="text-sm">Status: {selected.status}{selected.incidentId ? ` · Incident: ${selected.incidentId}` : ''}</p>}
      {(editing||creating)&&<Button disabled={busy||!description.trim()||!location.trim()||!itemNumber.trim()} onClick={()=>void save()}>Save</Button>}
    </CardContent></Card> : <Card><CardHeader><CardTitle>Records ({records.length})</CardTitle></CardHeader><CardContent className="space-y-3">
      <Input aria-label="Search records" placeholder="Search by item, description or location" value={search} onChange={e=>setSearch(e.target.value)}/>
      <Button onClick={()=>{setCreating(true);setEditing(true);setItemNumber('');setDescription('');setLocation('')}}>New Property</Button>
      <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[700px] text-sm"><thead className="bg-muted/50"><tr><th scope="col" className="px-3 py-2 text-left">Item #</th><th scope="col" className="px-3 py-2 text-left">Description</th><th scope="col" className="px-3 py-2 text-left">Status</th><th scope="col" className="px-3 py-2 text-left">Location</th><th scope="col" className="px-3 py-2 text-right">Actions</th></tr></thead><tbody>
      {records.filter(r=>[r.itemNumber,r.description,r.location].some(v=>v.toLowerCase().includes(search.toLowerCase()))).map(r=><tr key={r.id} className="border-t"><td className="px-3 py-3 font-medium">{r.itemNumber}</td><td className="px-3 py-3">{r.description}</td><td className="px-3 py-3">{r.status}</td><td className="px-3 py-3">{r.location}</td><td className="px-3 py-3"><div className="flex justify-end gap-2 whitespace-nowrap"><Button variant="outline" size="sm" onClick={()=>open(r,false)}>Inspect</Button><Button variant="outline" size="sm" onClick={()=>open(r,true)}>Edit</Button></div></td></tr>)}
      </tbody></table></div>
    </CardContent></Card>}
  </main>
}
