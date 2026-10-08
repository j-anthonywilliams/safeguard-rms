import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'
import { createProfileUpdate } from '@/lib/profile.functions'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Check,
  KeyRound,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

export const Route = createFileRoute('/app/profile')({
  head: () => ({
    meta: [
      {
        title: 'Profile · SafeGuard RMS',
      },
      {
        name: 'description',
        content:
          'Manage your SafeGuard RMS profile and account settings.',
      },
    ],
  }),
  component: ProfilePage,
})

function ProfileLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <ShieldCheck className="size-5 animate-pulse text-primary" />
    </div>
  )
}

function ProfilePage() {
  const {
    data: session,
    isPending: authLoading,
  } = authClient.useSession()

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.name,
      }
    : null

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (authLoading) {
      setLoading(true)
      return
    }

    setLoading(false)

    if (!user) {
      setDisplayName('')
      setPhone('')
      return
    }

    setDisplayName(user.displayName || '')
  }, [authLoading, user])

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()

    if (!user) return

    const trimmedName = displayName.trim()
    const trimmedPhone = phone.trim()

    if (!trimmedName) {
      toast.error('Display name is required')
      return
    }

    setSaving(true)

    try {
      const authResult = await authClient.updateUser({
        name: trimmedName,
      })

      if (authResult.error) {
        throw new Error(authResult.error.message)
      }

      await createProfileUpdate({
        data: {
          displayName: trimmedName,
          phone: trimmedPhone || null,
        },
      })

      toast.success('Profile updated', {
        description:
          'Your user settings have been saved.',
      })
    } catch (error) {
      toast.error('Could not update profile', {
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const sendPasswordReset = async () => {
    if (!user?.email) return

    setSendingReset(true)

    try {
      const result =
        await authClient.requestPasswordReset({
          email: user.email,
          redirectTo: '/app/profile',
        })

      if (result.error) {
        throw new Error(result.error.message)
      }

      toast.success('Password reset email requested', {
        description: `Check ${user.email} for a secure reset link.`,
      })
    } catch (error) {
      toast.error('Could not send reset email', {
        description:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      })
    } finally {
      setSendingReset(false)
    }
  }

  if (loading) {
    return <ProfileLoading />
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground">
        Please sign in to manage your profile.
      </div>
    )
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              Account / Settings
            </p>

            <h1 className="mt-2 font-serif text-3xl tracking-tight">
              Your profile
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Keep your contact details and sign-in credentials
              current.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() =>
              window.location.assign('/app')
            }
          >
            <ArrowLeft className="size-4" />
            Back to command center
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserRound className="size-5" />
              </div>

              <CardTitle className="mt-4">
                User details
              </CardTitle>

              <CardDescription>
                These details appear in your SafeGuard RMS
                profile.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form
                className="space-y-5"
                onSubmit={saveProfile}
              >
                <div className="space-y-2">
                  <Label htmlFor="profile-email">
                    Email address
                  </Label>

                  <Input
                    id="profile-email"
                    value={user.email || ''}
                    disabled
                  />

                  <p className="text-xs text-muted-foreground">
                    Your email is managed by secure
                    authentication.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display-name">
                    Display name
                  </Label>

                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={event =>
                      setDisplayName(event.target.value)
                    }
                    placeholder="Your name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Phone number
                  </Label>

                  <Input
                    id="phone"
                    value={phone}
                    onChange={event =>
                      setPhone(event.target.value)
                    }
                    placeholder="(555) 000-0000"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={saving}
                >
                  <Save className="size-4" />

                  {saving
                    ? 'Saving…'
                    : 'Save profile'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <KeyRound className="size-5" />
              </div>

              <CardTitle className="mt-4">
                Reset password
              </CardTitle>

              <CardDescription>
                Password changes are completed through a
                secure email link.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-5">
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  We’ll send a one-time password reset link
                  to{' '}
                  <span className="font-medium text-foreground">
                    {user.email}
                  </span>
                  .
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={sendPasswordReset}
                  disabled={sendingReset}
                >
                  <Check className="size-4" />

                  {sendingReset
                    ? 'Sending…'
                    : 'Send reset email'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}