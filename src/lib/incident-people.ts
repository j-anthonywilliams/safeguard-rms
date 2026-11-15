export const INCIDENT_RELATIONSHIPS = ['Victim', 'Witness', 'Suspect', 'Reporting Party', 'Other Party'] as const
export type IncidentRelationship = typeof INCIDENT_RELATIONSHIPS[number]
export interface IncidentPerson {
  id?: string
  name: string
  dateOfBirth: string
  phone: string
  email: string
  address: string
  relationships: IncidentRelationship[]
  comments: string
}
export function validateIncidentPeople(people: IncidentPerson[]): IncidentPerson[] {
  if (!Array.isArray(people) || people.length > 100) throw new Error('Invalid involved-person count')
  return people.map(person => {
    if (!person.name?.trim() || person.name.length > 200) throw new Error('Each involved person requires a name (max 200 characters)')
    if (!Array.isArray(person.relationships) || !person.relationships.length || person.relationships.some(r => !INCIDENT_RELATIONSHIPS.includes(r))) throw new Error('Select at least one valid relationship per person')
    if (person.dateOfBirth && (!/^\d{4}-\d{2}-\d{2}$/.test(person.dateOfBirth) || Number.isNaN(Date.parse(person.dateOfBirth)) || person.dateOfBirth > new Date().toISOString().slice(0,10))) throw new Error('Invalid date of birth')
    if (person.phone.length > 60 || person.email.length > 254 || person.address.length > 500 || person.comments.length > 4000) throw new Error('Involved-person field too long')
    return { ...person, name: person.name.trim(), relationships: [...new Set(person.relationships)] }
  })
}
