
export const INCIDENT_RELATIONSHIPS = [
  'Victim',
  'Witness',
  'Suspect',
  'Reporting Party',
  'Other Party',
] as const

export type IncidentRelationship =
  typeof INCIDENT_RELATIONSHIPS[number]

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

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)

  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function validateIncidentPeople(
  people: IncidentPerson[]
): IncidentPerson[] {
  if (!Array.isArray(people) || people.length > 100) {
    throw new Error('Invalid involved-person count')
  }

  return people.map(person => {
    if (!person || typeof person !== 'object') {
      throw new Error('Invalid involved-person record')
    }

    // Validate name
    if (
      typeof person.name !== 'string' ||
      !person.name.trim() ||
      person.name.length > 200
    ) {
      throw new Error(
        'Each involved person requires a name (max 200 characters)'
      )
    }

    // Validate relationships
    if (
      !Array.isArray(person.relationships) ||
      !person.relationships.length ||
      person.relationships.some(
        r => !INCIDENT_RELATIONSHIPS.includes(r)
      )
    ) {
      throw new Error(
        'Select at least one valid relationship per person'
      )
    }

    // Validate date of birth
    if (
      typeof person.dateOfBirth !== 'string'
    ) {
      throw new Error('Invalid date of birth')
    }

    if (person.dateOfBirth) {
      if (
        !isValidCalendarDate(person.dateOfBirth) ||
        person.dateOfBirth > new Date().toISOString().slice(0, 10)
      ) {
        throw new Error('Invalid date of birth')
      }
    }

    // Validate optional contact fields
    // Missing values are normalized to empty strings.
    const optionalFields = [
      ['phone', 60],
      ['email', 254],
      ['address', 500],
      ['comments', 4000],
    ] as const

    for (const [field, maxLength] of optionalFields) {
      const value = person[field]

      if (typeof value !== 'string') {
        throw new Error(`Invalid ${field} field`)
      }

      if (value.length > maxLength) {
        throw new Error(`Involved-person ${field} field too long`)
      }
    }

    return {
      ...person,
      name: person.name.trim(),
      relationships: [...new Set(person.relationships)],
    }
  })
}
