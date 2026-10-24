import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getPersonnelWorkspace,createAdministrativeReport,reviewPersonnelRequest } from '@/lib/personnel-workflows.functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
export const Route=createFileRoute('/app/administrative-reports')({component:AdministrativePage})
type Data=Awaited<ReturnType<typeof getPersonnelWorkspace>>
function AdministrativePage(){const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[title,setTitle]=useState(''),[narrative,setNarrative]=useState(''),[reviewNotes,setReviewNotes]=useState<Record<string,string>>({})
 const load=async()=>{try{setData(await getPersonnelWorkspace());setError('')}catch(e){setError(String(e))}};useEffect(()=>{void load()},[])
 const manager=data&&['office_staff','supervisor','admin','backend'].includes(data.role), reviewer=data&&['supervisor','admin','backend'].includes(data.role)
 const run=async(fn:()=>Promise<unknown>)=>{try{await fn();await load()}catch(e){setError(String(e))}}
 const decision=(id:string,value:'approved'|'rejected')=>void run(()=>reviewPersonnelRequest({data:{kind:'administrative_report',id,decision:value,note:reviewNotes[id]||''}}))
 return <main className="mx-auto max-w-5xl space-y-6 p-6"><h1 className="text-2xl font-semibold">Administrative Reports</h1><p className="text-sm text-muted-foreground">Personnel data — access restricted by role and customer.</p>{error&&<p role="alert" className="text-destructive">{error}</p>}
 {manager&&<section className="space-y-3 rounded-lg border p-4"><h2 className="font-semibold">New Administrative Report</h2><Input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)}/><textarea className="w-full rounded border p-2" placeholder="Narrative" rows={5} value={narrative} onChange={e=>setNarrative(e.target.value)}/><Button onClick={()=>void run(async()=>{await createAdministrativeReport({data:{title,narrative,subjectUserId:null}});setTitle('');setNarrative('')})}>Submit for Review</Button></section>}
 <section className="rounded-lg border p-4"><h2 className="mb-3 font-semibold">Administrative Reports</h2>{data?.reports.map(r=><div key={r.id} className="space-y-2 border-t py-3"><div className="flex justify-between gap-3"><span className="font-medium">{r.title} · {r.status==='pending'?'Awaiting Supervisor':r.status==='pending_manager'?'Awaiting Manager':r.status}</span></div><p className="whitespace-pre-wrap text-sm">{r.narrative}</p>{reviewer&&((data?.role==='supervisor'&&r.status==='pending')||(['admin','backend'].includes(data?.role||'')&&r.status==='pending_manager'))&&<div className="flex flex-wrap gap-2"><Input placeholder="Review note (required to reject)" value={reviewNotes[r.id]||''} onChange={e=>setReviewNotes(s=>({...s,[r.id]:e.target.value}))}/><Button onClick={()=>decision(r.id,'approved')}>Approve</Button><Button variant="outline" onClick={()=>decision(r.id,'rejected')}>Reject</Button></div>}</div>)}</section>
 </main>}
