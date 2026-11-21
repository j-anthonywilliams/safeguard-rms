import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listCommunications,listCommunicationRecipients,markCommunicationRead,sendCommunication } from '@/lib/communications.functions'

export const Route=createFileRoute('/app/communications')({component:Communications})
type Message=Awaited<ReturnType<typeof listCommunications>>['inbox'][number]
function Communications(){
 const [tab,setTab]=useState<'inbox'|'sent'|'compose'>('inbox')
 const [data,setData]=useState<Awaited<ReturnType<typeof listCommunications>>|null>(null)
 const [people,setPeople]=useState<Awaited<ReturnType<typeof listCommunicationRecipients>>>([])
 const [selected,setSelected]=useState<Message|null>(null)
 const [kind,setKind]=useState<'direct'|'announcement'>('direct')
 const [recipientId,setRecipientId]=useState('')
 const [subject,setSubject]=useState('')
 const [body,setBody]=useState('')
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const refresh=async()=>{const [messages,recipients]=await Promise.all([listCommunications(),listCommunicationRecipients()]);setData(messages);setPeople(recipients)}
 useEffect(()=>{refresh().catch(e=>setError(e instanceof Error?e.message:String(e)))},[])
 const open=async(m:Message)=>{setSelected(m);if(!m.readAt){try{await markCommunicationRead({data:{messageId:m.id}});await refresh()}catch(e){setError(e instanceof Error?e.message:String(e))}}}
 const send=async()=>{setBusy(true);setError('');try{await sendCommunication({data:{kind,recipientId,subject,body}});setSubject('');setBody('');setRecipientId('');await refresh();setTab('sent')}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 return <main className="mx-auto max-w-5xl space-y-5 p-6">
  <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Communications Center</h1><Button onClick={()=>setTab('compose')}>New Message</Button></div>
  {error&&<p role="alert" className="text-destructive">{error}</p>}
  <div className="flex flex-wrap gap-2"><Button variant={tab==='inbox'?'default':'outline'} onClick={()=>setTab('inbox')}>Inbox ({data?.unread??0} unread)</Button><Button variant={tab==='sent'?'default':'outline'} onClick={()=>setTab('sent')}>Sent</Button><Button variant={tab==='compose'?'default':'outline'} onClick={()=>setTab('compose')}>Compose</Button><Button variant="outline" onClick={()=>refresh().catch(e=>setError(String(e)))}>Refresh</Button></div>
  {tab==='compose'?<Card><CardHeader><CardTitle>New Communication</CardTitle></CardHeader><CardContent className="space-y-3">
    <label className="block text-sm">Message type<select className="mt-1 w-full rounded border bg-background p-2" value={kind} onChange={e=>setKind(e.target.value as 'direct'|'announcement')}><option value="direct">Direct message</option>{data?.canAnnounce&&<option value="announcement">Customer-wide announcement</option>}</select></label>
    {kind==='direct'&&<label className="block text-sm">Recipient<select className="mt-1 w-full rounded border bg-background p-2" value={recipientId} onChange={e=>setRecipientId(e.target.value)}><option value="">Select employee</option>{people.map(p=><option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}</select></label>}
    {kind==='announcement'&&<p className="text-sm text-muted-foreground">This announcement will be delivered to all active employees assigned to this customer.</p>}
    <Input aria-label="Subject" placeholder="Subject" maxLength={200} value={subject} onChange={e=>setSubject(e.target.value)}/>
    <textarea aria-label="Message" className="min-h-36 w-full rounded border bg-background p-3" maxLength={10000} placeholder="Write your message" value={body} onChange={e=>setBody(e.target.value)}/>
    <Button disabled={busy||!subject.trim()||!body.trim()||(kind==='direct'&&!recipientId)} onClick={send}>{busy?'Sending...':'Send'}</Button>
   </CardContent></Card>:<Card><CardHeader><CardTitle>{tab==='inbox'?'Received Messages':'Sent Messages'}</CardTitle></CardHeader><CardContent className="space-y-2">
    {(tab==='inbox'?data?.inbox:data?.sent)?.map(m=><button type="button" key={m.id} onClick={()=>tab==='inbox'?open(m as Message):setSelected(null)} className="w-full rounded border p-3 text-left hover:bg-muted/50"><div className="flex justify-between gap-2"><strong>{m.subject}</strong>{tab==='inbox'&&!(m as Message).readAt&&<span className="text-xs font-semibold">Unread</span>}</div><p className="text-sm text-muted-foreground">{tab==='inbox'?(m as Message).senderName:`${(m as {recipientCount:number}).recipientCount} recipients`} · {new Date(m.createdAt).toLocaleString()}</p><p className="mt-1 line-clamp-2 text-sm">{m.body}</p></button>)}
    {!(tab==='inbox'?data?.inbox:data?.sent)?.length&&<p className="text-sm text-muted-foreground">No messages yet.</p>}
   </CardContent></Card>}
  {selected&&tab==='inbox'&&<Card><CardHeader><CardTitle>{selected.subject}</CardTitle></CardHeader><CardContent><p className="mb-3 text-sm text-muted-foreground">From {selected.senderName}</p><p className="whitespace-pre-wrap break-words">{selected.body}</p><Button className="mt-4" variant="outline" onClick={()=>setSelected(null)}>Close</Button></CardContent></Card>}
 </main>
}
