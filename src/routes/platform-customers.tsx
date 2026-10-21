
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
          <p className="mt-2 text-muted-foreground">
            Customer Directory
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded border p-4 text-destructive">
            {error}
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
