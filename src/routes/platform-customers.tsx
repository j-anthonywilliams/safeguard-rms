import { canRegisterCustomers, registerPlatformCustomer } from '@/lib/platform-customer-registration.functions'

import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import {
  getMyPlatformMemberships,
} from '@/lib/platform-memberships.functions'

import {
  getAuthorizedCustomerRoute,
} from '@/lib/platform-customer-routing.functions'

type Customer = Awaited<
  ReturnType<typeof getMyPlatformMemberships>
>[number]

export const Route = createFileRoute('/platform-customers')({
  component: PlatformCustomers,
})

function PlatformCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [mayRegister, setMayRegister] = useState(false)
  const [showRegistration, setShowRegistration] = useState(false)
  const [customerCode, setCustomerCode] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [websiteSlug, setWebsiteSlug] = useState('')
  const [registering, setRegistering] = useState(false)
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null)
  useEffect(() => {
    void canRegisterCustomers().then(setMayRegister).catch(() => setMayRegister(false))
  }, [])
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    getMyPlatformMemberships()
      .then(result => {
        if (active) setCustomers(result)
      })
      .catch(err => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load customers',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function openCustomer(customerId: string) {
    setOpening(customerId)
    setError(null)

    try {
      const route = await getAuthorizedCustomerRoute({
        data: { customerId },
      })

      const destination = new URL(route.websiteUrl)

      if (!['http:', 'https:'].includes(destination.protocol)) {
        throw new Error('Invalid customer website')
      }

      window.location.assign(destination.href)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Customer access denied',
      )
      setOpening(null)
    }
  }

  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">
            SafeGuard-RMS Platform
          </h1>
          <p className="mt-2 text-muted-foreground">Customer Directory</p>
          {mayRegister && <a href="/platform-users" className="mt-3 inline-block text-sm underline">Platform User Management</a>}
        </div>
        {mayRegister && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Customer Registration</h2>
              <button type="button" className="rounded border px-3 py-2" onClick={() => setShowRegistration(value => !value)}>
                {showRegistration ? 'Cancel' : 'Create Customer'}
              </button>
            </div>
            {registrationMessage && <p role="status" className="text-sm">{registrationMessage}</p>}
            {showRegistration && (
              <form className="grid gap-3" onSubmit={async event => {
                event.preventDefault()
                setRegistering(true)
                setRegistrationMessage(null)
                try {
                  await registerPlatformCustomer({ data: { customerCode, name: customerName, websiteSlug } })
                  setRegistrationMessage('Customer registered as inactive. Provisioning required.')
                  setCustomerCode(''); setCustomerName(''); setWebsiteSlug('')
                  setShowRegistration(false)
                } catch (err) {
                  setRegistrationMessage(err instanceof Error ? err.message : 'Registration failed')
                } finally { setRegistering(false) }
              }}>
                <input aria-label="Customer code" required placeholder="Customer code (DEV002)" className="rounded border bg-background p-2" value={customerCode} onChange={e => setCustomerCode(e.target.value)} />
                <input aria-label="Customer name" required placeholder="Customer name" className="rounded border bg-background p-2" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                <input aria-label="Website slug" required placeholder="Website slug (dev002)" className="rounded border bg-background p-2" value={websiteSlug} onChange={e => setWebsiteSlug(e.target.value)} />
                <button type="submit" disabled={registering} className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">Register Customer</button>
              </form>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="space-y-2 rounded border p-4 text-destructive">
            <p>{error}</p>
            {error === 'Platform authentication required' && (
              <a className="inline-block rounded border px-3 py-2 text-sm underline" href="/platform-login">
                Sign in to the central platform
              </a>
            )}
          </div>
        )}

        {loading ? (
          <p>Loading customers...</p>
        ) : customers.length === 0 ? (
          <p>No customers available for this account.</p>
        ) : (
          <div className="grid gap-4">
            {customers.map(customer => (
              <div
                key={customer.customerId}
                className="flex items-center justify-between rounded-lg border p-5"
              >
                <div>
                  <h2 className="font-semibold">
                    {customer.customerName}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {customer.customerCode}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {customer.customerRole ??
                      customer.platformRole ??
                      'Directory access'}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    opening !== null ||
                    customer.customerRole === null
                  }
                  onClick={() => openCustomer(customer.customerId)}
                  className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                >
                  {opening === customer.customerId
                    ? 'Opening...'
                    : customer.customerRole === null
                      ? 'Not assigned'
                      : 'Open Customer'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
