import { canRegisterCustomers, registerPlatformCustomer } from '@/lib/platform-customer-registration.functions'

import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Building2, Plus, RefreshCw, MapPin, Info } from 'lucide-react'
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
  createOrganizationSite,
  updateOrganizationSite,
  archiveOrganizationSite,
  restoreOrganizationSite,
  getOrganizationUserAssignments,
  assignOrganizationUser,
  removeOrganizationUserAssignment,
  type OrganizationUserAssignment,
  type OrganizationAssignmentType,
  type OrganizationCustomer,
  type OrganizationClient,
  type OrganizationSite,
} from '@/lib/organization.functions'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getUserDirectory } from '@/lib/users.functions'

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
  const [mayRegister, setMayRegister] = useState(false)
  const [openRegistration, setOpenRegistration] = useState<'customer' | 'client' | 'site' | null>(null)
  const [customerCodeInput, setCustomerCodeInput] = useState('')
  const [customerNameInput, setCustomerNameInput] = useState('')
  const [customerSlugInput, setCustomerSlugInput] = useState('')
  const [customerRegisterBusy, setCustomerRegisterBusy] = useState(false)
  useEffect(() => { void canRegisterCustomers().then(setMayRegister).catch(() => setMayRegister(false)) }, [])
  const [clients, setClients] = useState<OrganizationClient[]>([])
  const [sites, setSites] = useState<OrganizationSite[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [clientCode, setClientCode] = useState('')
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [editingClientName, setEditingClientName] = useState('')
  const [clientActionId, setClientActionId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')

  const [siteClientId, setSiteClientId] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [siteName, setSiteName] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [siteCity, setSiteCity] = useState('')
  const [siteState, setSiteState] = useState('')
  const [sitePostalCode, setSitePostalCode] = useState('')

  const [siteSaving, setSiteSaving] = useState(false)
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)
  const [editingSiteName, setEditingSiteName] = useState('')
  const [editingSiteAddress, setEditingSiteAddress] = useState('')
  const [editingSiteCity, setEditingSiteCity] = useState('')
  const [editingSiteState, setEditingSiteState] = useState('')
  const [editingSitePostalCode, setEditingSitePostalCode] = useState('')
  const [siteActionId, setSiteActionId] = useState<string | null>(null)
  const [directoryUsers, setDirectoryUsers] = useState<
    { id: string; email: string; displayName: string | null }[]
  >([])

  const [assignments, setAssignments] = useState<
    OrganizationUserAssignment[]
  >([])

  const [selectedUserId, setSelectedUserId] = useState('')
  const [assignmentType, setAssignmentType] =
    useState<OrganizationAssignmentType>('customer')
  const [selectedOrganizationId, setSelectedOrganizationId] =
    useState('')

  const [assignmentBusy, setAssignmentBusy] = useState(false)
  const loadOrganization = async () => {
    try {
      setLoading(true)
      const [data, directory, userAssignments] = await Promise.all([
      getOrganizationStructure(),
      getUserDirectory(),
      getOrganizationUserAssignments(),
    ])

    setCustomers(data.customers)
    setClients(data.clients)
    setSites(data.sites)

    setDirectoryUsers(
      directory.users.map(user => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      }))
    )

setAssignments(userAssignments)
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
      setOpenRegistration(null)

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

const handleCreateSite = async () => {
  if (!siteClientId || !siteCode.trim() || !siteName.trim()) {
    toast.error('Client, site code, and site name are required')
    return
  }

  try {
    setSiteSaving(true)

    await createOrganizationSite({
      data: {
        clientId: siteClientId,
        siteCode,
        name: siteName,
        addressLine1: siteAddress || null,
        addressLine2: null,
        city: siteCity || null,
        state: siteState || null,
        postalCode: sitePostalCode || null,
      },
    })

    toast.success('Site created successfully')

    setSiteCode('')
    setSiteName('')
    setSiteAddress('')
    setSiteCity('')
    setSiteState('')
    setSitePostalCode('')
    setOpenRegistration(null)

    await loadOrganization()
  } catch (error) {
    toast.error('Could not create site', {
      description:
        error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    setSiteSaving(false)
  }
}


const startEditingSite = (site: OrganizationSite) => {
  setEditingSiteId(site.id)
  setEditingSiteName(site.name)
  setEditingSiteAddress(site.addressLine1 ?? '')
  setEditingSiteCity(site.city ?? '')
  setEditingSiteState(site.state ?? '')
  setEditingSitePostalCode(site.postalCode ?? '')
}

const handleUpdateSite = async (siteId: string) => {
  if (!editingSiteName.trim()) {
    toast.error('Site name is required')
    return
  }

  try {
    setSiteActionId(siteId)

    await updateOrganizationSite({
      data: {
        siteId,
        name: editingSiteName,
        addressLine1: editingSiteAddress || null,
        addressLine2: null,
        city: editingSiteCity || null,
        state: editingSiteState || null,
        postalCode: editingSitePostalCode || null,
      },
    })

    toast.success('Site updated')
    setEditingSiteId(null)
    await loadOrganization()
  } catch (error) {
    toast.error('Could not update site', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    setSiteActionId(null)
  }
}

const handleArchiveSite = async (site: OrganizationSite) => {
  if (!window.confirm(`Archive ${site.name}?`)) return

  try {
    setSiteActionId(site.id)

    await archiveOrganizationSite({
      data: { siteId: site.id },
    })

    toast.success('Site archived')
    await loadOrganization()
  } catch (error) {
    toast.error('Could not archive site', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    setSiteActionId(null)
  }
}

const handleRestoreSite = async (siteId: string) => {
  try {
    setSiteActionId(siteId)

    await restoreOrganizationSite({
      data: { siteId },
    })

    toast.success('Site restored')
    await loadOrganization()
  } catch (error) {
    toast.error('Could not restore site', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    setSiteActionId(null)
  }
}


const handleAssignUser = async () => {
  if (!selectedUserId || !selectedOrganizationId) {
    toast.error('Select a user and organization')
    return
  }

  try {
    setAssignmentBusy(true)

    await assignOrganizationUser({
      data: {
        userId: selectedUserId,
        assignmentType,
        organizationId: selectedOrganizationId,
      },
    })

    toast.success('User assignment created')
    setSelectedOrganizationId('')
    await loadOrganization()
  } catch (error) {
    toast.error('Could not assign user', {
      description:
        error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    setAssignmentBusy(false)
  }
}

const handleRemoveAssignment = async (
  assignment: OrganizationUserAssignment
) => {
  if (
    !window.confirm(
      `Remove ${assignment.userName || assignment.userEmail} from ${assignment.organizationName}?`
    )
  ) {
    return
  }

  try {
    setAssignmentBusy(true)

    await removeOrganizationUserAssignment({
      data: {
        assignmentType: assignment.assignmentType,
        assignmentId: assignment.id,
      },
    })

    toast.success('Assignment removed')
    await loadOrganization()
  } catch (error) {
    toast.error('Could not remove assignment', {
      description:
        error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    setAssignmentBusy(false)
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
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Customer Directory
                </CardTitle>
                {mayRegister && (
                  <Button size="sm" variant="outline" onClick={() => setOpenRegistration(openRegistration === 'customer' ? null : 'customer')}>
                    <Plus className="mr-2 h-4 w-4" />Create Customer
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
          {mayRegister && openRegistration === 'customer' && <div className="space-y-3 rounded-md border p-4">
            <h3 className="font-medium">Register New Customer</h3>
            <p className="text-sm text-muted-foreground">Registration creates an inactive platform directory entry. Database provisioning and activation are separate steps.</p>
            <Input aria-label="New customer code" placeholder="Customer code (e.g. DEV002)" value={customerCodeInput} onChange={e => setCustomerCodeInput(e.target.value)} />
            <Input aria-label="New customer name" placeholder="Customer name" value={customerNameInput} onChange={e => setCustomerNameInput(e.target.value)} />
            <Input aria-label="New customer slug" placeholder="Website slug (e.g. dev002)" value={customerSlugInput} onChange={e => setCustomerSlugInput(e.target.value)} />
            <Button disabled={customerRegisterBusy} onClick={async () => {
              setCustomerRegisterBusy(true)
              try {
                await registerPlatformCustomer({data:{customerCode:customerCodeInput,name:customerNameInput,websiteSlug:customerSlugInput}})
                toast.success('Customer registered as inactive; provisioning required')
                setCustomerCodeInput(''); setCustomerNameInput(''); setCustomerSlugInput(''); setOpenRegistration(null); await loadOrganization()
              } catch (error) { toast.error(error instanceof Error ? error.message : 'Registration failed') }
              finally { setCustomerRegisterBusy(false) }
            }}>Register Customer</Button>
            <Button variant="outline" onClick={() => setOpenRegistration(null)}>Cancel</Button>
          </div>}
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
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Client Directory</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setOpenRegistration(openRegistration === 'client' ? null : 'client')}>
                  <Plus className="mr-2 h-4 w-4" />Create Client
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
          {openRegistration === 'client' && <div className="space-y-4 rounded-md border p-4">
              <h3 className="font-medium">Create Client</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="client-code" className="text-sm font-medium">
                      Client Code
                    </label>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Client code requirements"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>

                      <TooltipContent side="top" className="max-w-72">
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold">Client Code Requirements</p>
                          <p>1–32 characters.</p>
                          <p>Letters A–Z, numbers 0–9, hyphens (-), and underscores (_) only.</p>
                          <p>No spaces or periods.</p>
                          <p>Lowercase letters are automatically converted to uppercase.</p>
                          <p>Examples: HQ, SITE001, NORTH-01</p>
                          <p>Codes must be unique within the customer.</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <Input
                    id="client-code"
                    placeholder="e.g. CLIENT001"
                    value={siteCode}
                    onChange={event => setSiteCode(event.target.value)}
                    maxLength={32}
                  />
                </div>

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
              <Button variant="outline" onClick={() => setOpenRegistration(null)}>Cancel</Button>
          </div>}


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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Site Management
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium">Site Directory</h3>
                  <Button size="sm" variant="outline" onClick={() => setOpenRegistration(openRegistration === 'site' ? null : 'site')}>
                    <Plus className="mr-2 h-4 w-4" />Create Site
                  </Button>
                </div>
              {openRegistration === 'site' && <div className="space-y-4 rounded-md border p-4">
                <h3 className="font-medium">Create Site</h3>

                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={siteClientId}
                  onChange={event => setSiteClientId(event.target.value)}
                >
                  <option value="">Select a client</option>
                  {clients
                    .filter(client => client.status === 'active')
                    .map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} ({client.clientCode})
                      </option>
                    ))}
                </select>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    placeholder="Site code"
                    value={siteCode}
                    onChange={event => setSiteCode(event.target.value)}
                  />

                  <Input
                    placeholder="Site name"
                    value={siteName}
                    onChange={event => setSiteName(event.target.value)}
                  />

                  <Input
                    placeholder="Street address"
                    value={siteAddress}
                    onChange={event => setSiteAddress(event.target.value)}
                  />

                  <Input
                    placeholder="City"
                    value={siteCity}
                    onChange={event => setSiteCity(event.target.value)}
                  />

                  <Input
                    placeholder="State"
                    value={siteState}
                    onChange={event => setSiteState(event.target.value)}
                  />

                  <Input
                    placeholder="ZIP code"
                    value={sitePostalCode}
                    onChange={event => setSitePostalCode(event.target.value)}
                  />
                </div>

                <Button
                  onClick={() => void handleCreateSite()}
                  disabled={siteSaving}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {siteSaving ? 'Creating...' : 'Create Site'}
                </Button>
                <Button variant="outline" onClick={() => setOpenRegistration(null)}>Cancel</Button>
              </div>}



                
                {sites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No sites have been created.
                  </p>
                ) : (
                  sites.map(site => {
                    const parentClient = clients.find(
                      client => client.id === site.clientId
                    )

                    return (
                      <div
                        key={site.id}
                        className="space-y-3 rounded-md border p-4"
                      >
                        {editingSiteId === site.id ? (
                          <div className="space-y-3">
                            <Input
                              placeholder="Site name"
                              value={editingSiteName}
                              onChange={event => setEditingSiteName(event.target.value)}
                            />
                            <Input
                              placeholder="Street address"
                              value={editingSiteAddress}
                              onChange={event => setEditingSiteAddress(event.target.value)}
                            />
                            <div className="grid gap-3 md:grid-cols-3">
                              <Input
                                placeholder="City"
                                value={editingSiteCity}
                                onChange={event => setEditingSiteCity(event.target.value)}
                              />
                              <Input
                                placeholder="State"
                                value={editingSiteState}
                                onChange={event => setEditingSiteState(event.target.value)}
                              />
                              <Input
                                placeholder="ZIP code"
                                value={editingSitePostalCode}
                                onChange={event => setEditingSitePostalCode(event.target.value)}
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                disabled={siteActionId !== null}
                                onClick={() => void handleUpdateSite(site.id)}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={siteActionId !== null}
                                onClick={() => setEditingSiteId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{site.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {site.siteCode}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Client: {parentClient?.name || 'Unknown'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {[site.addressLine1, site.city, site.state, site.postalCode]
                                  .filter(Boolean)
                                  .join(', ')}
                              </p>
                              <p className="mt-2 text-xs capitalize text-muted-foreground">
                                Status: {site.status}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={siteActionId !== null || site.status === 'archived'}
                                onClick={() => startEditingSite(site)}
                              >
                                Edit
                              </Button>

                              {site.status === 'archived' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={siteActionId !== null}
                                  onClick={() => void handleRestoreSite(site.id)}
                                >
                                  Restore
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={siteActionId !== null}
                                  onClick={() => void handleArchiveSite(site)}
                                >
                                  Archive
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>User Assignments</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-medium">Assign User</h3>

                <div className="grid gap-3 md:grid-cols-3">
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedUserId}
                    onChange={event => setSelectedUserId(event.target.value)}
                  >
                    <option value="">Select user</option>
                    {directoryUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.displayName || user.email}
                      </option>
                    ))}
                  </select>

                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={assignmentType}
                    onChange={event => {
                      setAssignmentType(
                        event.target.value as OrganizationAssignmentType
                      )
                      setSelectedOrganizationId('')
                    }}
                  >
                    <option value="customer">Customer</option>
                    <option value="client">Client</option>
                    <option value="site">Site</option>
                  </select>

                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedOrganizationId}
                    onChange={event =>
                      setSelectedOrganizationId(event.target.value)
                    }
                  >
                    <option value="">Select organization</option>

                    {assignmentType === 'customer' &&
                      customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}

                    {assignmentType === 'client' &&
                      clients
                        .filter(client => client.status === 'active')
                        .map(client => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}

                    {assignmentType === 'site' &&
                      sites
                        .filter(site => site.status === 'active')
                        .map(site => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                  </select>
                </div>

                <Button
                  disabled={assignmentBusy}
                  onClick={() => void handleAssignUser()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Assign User
                </Button>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">Existing Assignments</h3>

                {assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No organizational assignments found.
                  </p>
                ) : (
                  assignments.map(assignment => (
                    <div
                      key={assignment.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
                    >
                      <div>
                        <p className="font-medium">
                          {assignment.userName || assignment.userEmail}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {assignment.assignmentType}: {assignment.organizationName}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={assignmentBusy}
                        onClick={() =>
                          void handleRemoveAssignment(assignment)
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

        </>
      )}
    </div>
  )
}
