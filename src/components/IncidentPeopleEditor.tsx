import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { INCIDENT_RELATIONSHIPS, type IncidentPerson, type IncidentRelationship } from '@/lib/incident-people'

const blank = (): IncidentPerson => ({name:'',dateOfBirth:'',phone:'',email:'',address:'',relationships:['Other Party'],comments:''})
export function IncidentPeopleEditor({people,onChange}:{people:IncidentPerson[],onChange:(people:IncidentPerson[])=>void}) {
  const [expanded,setExpanded] = useState<number|null>(null)
  const update = (i:number,changes:Partial<IncidentPerson>) => onChange(people.map((p,j)=>i===j?{...p,...changes}:p))
  return <section className="sm:col-span-2 space-y-3 rounded-lg border p-4">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Involved Persons ({people.length})</h3>
      <Button type="button" variant="outline" onClick={()=>{onChange([...people,blank()]);setExpanded(people.length)}}>Add Another Person</Button></div>
    {people.map((person,i)=><div className="space-y-3 rounded-md border p-3" key={person.id||`new-${i}`}>
      <div className="flex items-center justify-between gap-2"><button type="button" className="text-left font-medium underline" onClick={()=>setExpanded(expanded===i?null:i)}>{i+1}. {person.name||'New person'} — {person.relationships.join(', ')}</button>
        <Button type="button" variant="outline" onClick={()=>{onChange(people.filter((_,j)=>j!==i));setExpanded(null)}}>Remove</Button></div>
      {expanded===i&&<div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Full name *<Input value={person.name} onChange={e=>update(i,{name:e.target.value})} maxLength={200}/></label>
        <label className="text-sm">Date of birth<Input type="date" value={person.dateOfBirth} onChange={e=>update(i,{dateOfBirth:e.target.value})}/></label>
        <label className="text-sm">Phone<Input type="tel" value={person.phone} onChange={e=>update(i,{phone:e.target.value})}/></label>
        <label className="text-sm">Email<Input type="email" value={person.email} onChange={e=>update(i,{email:e.target.value})}/></label>
        <label className="text-sm sm:col-span-2">Residential / mailing address<Input value={person.address} onChange={e=>update(i,{address:e.target.value})}/></label>
        <fieldset className="sm:col-span-2"><legend className="text-sm font-medium">Relationship(s) to incident *</legend><div className="mt-2 flex flex-wrap gap-3">{INCIDENT_RELATIONSHIPS.map(role=><label className="flex items-center gap-1 text-sm" key={role}><input type="checkbox" checked={person.relationships.includes(role)} onChange={e=>update(i,{relationships:e.target.checked?[...person.relationships,role]:person.relationships.filter((r:IncidentRelationship)=>r!==role)})}/>{role}</label>)}</div></fieldset>
        <label className="text-sm sm:col-span-2">Additional comments<textarea className="mt-1 w-full rounded border bg-background p-2" rows={3} value={person.comments} onChange={e=>update(i,{comments:e.target.value})}/></label>
      </div>}
    </div>)}
  </section>
}
