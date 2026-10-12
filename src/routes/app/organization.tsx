
import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Building2, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { ClientBoundary } from '@/components/ClientBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import {
  getOrganizationStructure,
  createOrganizationClient,
  updateOrganizationClient,
  archiveOrganizationClient,
  restoreOrganizationClient,
  type OrganizationCustomer,
  type OrganizationClient,
  type OrganizationSite,
} from '@/lib/organization.functions'

export const Route = createFileRoute('/app/organization')({
  head: () => ({
    meta: [
      { title: 'Organization Management - SafeGuard RMS' },
    ],
  }),
  component: () => (
    <ClientBoundary fallback={<div className="p-6">Loading...</div>}>
      <OrganizationManagementPage />
    </ClientBoundary>
  ),
})

function OrganizationManagementPage() {
  const [customers, setCustomers] = useState<OrganizationCustomer[]>([])
  const [clients, setClients] = useState<OrganizationClient[]>([])
  const [sites, setSites] = useState<OrganizationSite[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [clientCode, setClientCode] = useState('')
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [editingClientName, setEditingClientName] = useState('')
  const [clientActionId, setClientActionId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')

  const loadOrganization = async () => {
    try {
      setLoading(true)
      const data = await getOrganizationStructure()
      setCustomers(data.customers)
      setClients(data.clients)
      setSites(data.sites)
    } catch (error) {
      toast.error('Could not load organization', {
        description:
          error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOrganization()
  }, [])

  const handleCreateClient = async () => {
    if (!clientCode.trim() || !clientName.trim()) {
      toast.error('Client code and name are required')
      return
    }

    try {
      setSaving(true)

      await createOrganizationClient({
        data: {
          clientCode,
          name: clientName,
        },
      })

      toast.success('Client created successfully')

      setClientCode('')
      setClientName('')

      await loadOrganization()
    } catch (error) {
      toast.error('Could not create client', {
        description:
          error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setSaving(false)
    }
  }
const handleUpdateClient = async (clientId: string) => {
  if (!editingClientName.trim()) {
    toast.error('Client name is required')
    return
  }

  try {
    setClientActionId(clientId)

    await updateOrganizationClient({
      data: {
        clientId,
        name: editingClientName,
      },
    })

    toast.success('Client updated')
    setEditingClientId(null)
    setEditingClientName('')
    await loadOrganization()
  } catch (error) {
    toast.error('Could not update client', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    setClientActionId(null)
  }
}

const handleArchiveClient = async (client: OrganizationClient) => {
  if (client.clientCode === 'DEFAULT') {
    toast.error('The default client cannot be archived')
    return
  }

  if (!window.confirm(`Archive ${client.name}?`)) return

  try {
    setClientActionId(client.id)

    await archiveOrganizationClient({
      data: { clientId: client.id },
    })

    toast.success('Client archived')
    await loadOrganization()
  } catch (error) {
    toast.error('Could not archive client', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    setClientActionId(null)
  }
}

const handleRestoreClient = async (clientId: string) => {
  try {
    setClientActionId(clientId)

    await restoreOrganizationClient({
      data: { clientId },
    })

    toast.success('Client restored')
    await loadOrganization()
  } catch (error) {
    toast.error('Could not restore client', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    setClientActionId(null)
  }
}
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Organization Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage customer organizations, clients, and sites.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => void loadOrganization()}
          disabled={loading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">
          Loading organization...
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Customers</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">
                {customers.length}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clients</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">
                {clients.length}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sites</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">
                {sites.length}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customers.map(customer => (
                <div
                  key={customer.id}
                  className="rounded-md border p-4"
                >
                  <p className="font-semibold">{customer.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Code: {customer.customerCode}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Website: {customer.websiteSlug}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Status: {customer.status}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Client code (e.g. PATROL)"
                  value={clientCode}
                  onChange={event => setClientCode(event.target.value)}
                  maxLength={32}
                />

                <Input
                  placeholder="Client name"
                  value={clientName}
                  onChange={event => setClientName(event.target.value)}
                />
              </div>

              <Button
                onClick={() => void handleCreateClient()}
                disabled={saving}
              >
                <Plus className="mr-2 h-4 w-4" />
                {saving ? 'Creating...' : 'Create Client'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Directory</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No clients found.
                </p>
              ) : (
                clients.map(client => (
                  <div
                    key={client.id}
                    className="rounded-md border p-4 space-y-3"
                  >
                    {editingClientId === client.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={editingClientName}
                          onChange={event => setEditingClientName(event.target.value)}
                          className="min-w-48 flex-1"
                        />

                        <Button
                          size="sm"
                          disabled={clientActionId !== null}
                          onClick={() => void handleUpdateClient(client.id)}
                        >
                          Save
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingClientId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {client.clientCode}
                          </p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {client.status}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={clientActionId !== null}
                            onClick={() => {
                              setEditingClientId(client.id)
                              setEditingClientName(client.name)
                            }}
                          >
                            Edit
                          </Button>

                          {client.status === 'archived' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={clientActionId !== null}
                              onClick={() => void handleRestoreClient(client.id)}
                            >
                              Restore
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                clientActionId !== null ||
                                client.clientCode === 'DEFAULT'
                              }
                              onClick={() => void handleArchiveClient(client)}
                            >
                              Archive
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
