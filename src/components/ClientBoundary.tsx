import { ClientOnly } from '@tanstack/react-router'
import type { ReactNode } from 'react'

/**
 * SSR-safe client rendering boundary for SafeGuard-RMS.
 *
 * SafeGuard-RMS uses TanStack Start for server-side rendering (SSR).
 * Components that access browser-only APIs during rendering, such as
 * localStorage, window, or browser-dependent authentication state,
 * may cause server rendering errors or hydration mismatches.
 *
 * This boundary prevents those issues by rendering a fallback on the
 * server and mounting the actual component in the browser.
 *
 * Example:
 *
 *   <ClientBoundary fallback={<LoadingShell />}>
 *     <UserManagementPage />
 *   </ClientBoundary>
 *
 * Keep components that do not require browser APIs outside this
 * boundary whenever possible to preserve server-side rendering,
 * performance, and search engine accessibility.
 *
 * This component uses TanStack Router's ClientOnly functionality.
 * It should remain available for application components that
 * require browser-only rendering.
 */

export function ClientBoundary({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  return <ClientOnly fallback={fallback}>{children}</ClientOnly>
}
