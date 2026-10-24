
import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/platform-login')({
  component: PlatformLogin,
})

function PlatformLogin() {
  // Global authentication belongs to the central platform, never a customer app.
  useEffect(() => {
    const platformOrigin = import.meta.env.VITE_PLATFORM_URL || 'http://localhost:3000'
    const destination = new URL('/platform-login', platformOrigin)
    if (window.location.origin !== destination.origin) {
      destination.search = window.location.search
      window.location.replace(destination.toString())
    }
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async () => {
    if (busy) return

    setBusy(true)
    setError(null)

    try {
      const response = await fetch(
        '/api/platform-auth/sign-in/email',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            email,
            password,
            rememberMe: true,
          }),
        },
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.message || 'Platform sign-in failed',
        )
      }

      // Preserve the original OIDC authorization request.
      const params = new URLSearchParams(window.location.search)

      if (
        params.has('client_id') &&
        params.has('response_type') &&
        params.has('redirect_uri')
      ) {
        window.location.assign(
          `/api/platform-auth/oauth2/authorize${window.location.search}`,
        )
      } else {
        window.location.assign('/platform-customers')
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Authentication failed',
      )
    } finally {
      setBusy(false)
    }
  }

  const signInWithGoogle = async () => {
    if (busy) return
    setBusy(true)
    setError(null)

    try {
      const params = new URLSearchParams(window.location.search)
      const hasOidcRequest =
        params.has('client_id') &&
        params.has('response_type') &&
        params.has('redirect_uri')
      const callbackURL = hasOidcRequest
        ? `/api/platform-auth/oauth2/authorize${window.location.search}`
        : '/platform-customers'

      const response = await fetch('/api/platform-auth/sign-in/social', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google', callbackURL }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.url) {
        throw new Error(result?.message || 'Google sign-in is unavailable')
      }
      window.location.assign(result.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setBusy(false)
    }
  }

  const platformOrigin = import.meta.env.VITE_PLATFORM_URL || 'http://localhost:3000'
  if (typeof window !== 'undefined' && window.location.origin !== new URL(platformOrigin).origin) {
    return <main className="p-6 text-sm">Redirecting to platform sign-in...</main>
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            SafeGuard-RMS Platform Login
          </CardTitle>

          <p className="text-sm text-muted-foreground">
            Sign in to access your authorized customer applications.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="platform-email"
              className="text-sm font-medium"
            >
              Email
            </label>

            <Input
              id="platform-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={event => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="platform-password"
              className="text-sm font-medium"
            >
              Password
            </label>

            <Input
              id="platform-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            className="w-full"
            disabled={busy || !email || !password}
            onClick={signIn}
          >
            {busy ? 'Signing in...' : 'Sign In'}
          </Button>
          <Button
            className="w-full"
            variant="outline"
            disabled={busy}
            onClick={signInWithGoogle}
          >
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
