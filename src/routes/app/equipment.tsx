import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getDashboardData } from '@/lib/dashboard.functions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/app/equipment')({ component: DirectoryPage })

type Row = Awaited<ReturnType<typeof getDashboardData>>['equipment'][number]
function DirectoryPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getDashboardData().then(data => { if (active) setRows(data.equipment) }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : 'Unable to load records')
    })
    return () => { active = false }
  }, [])
  return <main className="mx-auto max-w-5xl space-y-5 p-6">
    <h1 className="text-2xl font-semibold">Equipment Desk</h1>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Card><CardHeader><CardTitle>Records ({rows.length})</CardTitle></CardHeader><CardContent className="space-y-3">
      <Input aria-label="Search records" placeholder="Search records" value={search} onChange={e => setSearch(e.target.value)} />
      {rows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())).map(row =>
        <div key={row.id} className="border-b py-3 last:border-0">
          <p className="font-medium">{row.name}</p>
          <p className="text-sm text-muted-foreground">{row.serialNumber}</p>
        </div>
      )}
    </CardContent></Card>
  </main>
}
