
import { useState } from 'react'
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
        window.location.assign('/')
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
        </CardContent>
      </Card>
    </main>
  )
}
