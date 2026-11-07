import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { Logo } from '../../components/Logo'
import { Splash } from '../../components/Splash'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/Fields'
import { errorMessage } from '../../lib/api'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useStaff } from '../../state/staff'

export function StaffLoginPage() {
  useDocumentTitle('Dashboard sign in')
  const { status, user, login } = useStaff()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'loading') return <Splash />
  if (user) return <Navigate to="/dashboard" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="grid place-items-center bg-navy px-6 py-10 md:min-h-dvh">
        <Logo variant="full" height={180} tone="cream" />
      </div>
      <div className="relative grid place-items-center px-6 py-10">
        <ThemeToggle className="absolute top-4 right-4" />
        <form onSubmit={submit} className="w-full max-w-sm" noValidate>
          <h1 className="text-display-lg font-bold">Dashboard</h1>
          <p className="mt-2 mb-8 text-body text-muted">Sign in with your staff account.</p>
          <div className="grid gap-5">
            <TextField
              label="Username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              required
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
            />
            {error && (
              <p role="alert" className="text-body-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" size="xl" block busy={busy} disabled={!username.trim() || !password}>
              Sign in
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
