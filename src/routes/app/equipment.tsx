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
      <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/50"><tr><th className="px-3 py-2 text-left font-medium" scope="col">Equipment</th><th className="px-3 py-2 text-left font-medium" scope="col">Serial Number</th><th className="px-3 py-2 text-left font-medium" scope="col">Status</th><th className="px-3 py-2 text-left font-medium" scope="col">Assigned To</th></tr></thead><tbody>
        {rows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())).map(row => <tr key={row.id} className="border-t"><td className="px-3 py-3 align-middle">{row.name}</td><td className="px-3 py-3 align-middle">{row.serialNumber}</td><td className="px-3 py-3 align-middle">{row.status}</td><td className="px-3 py-3 align-middle">{row.assignedTo || "Unassigned"}</td></tr>)}
      </tbody></table></div>
    </CardContent></Card>
  </main>
}
