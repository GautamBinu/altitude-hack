import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/api'
import { useTheme } from '../lib/theme'
import { useSession } from '../state/session'
import { Button } from './ui/Button'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

let googleScript: Promise<void> | null = null

/** Google's sign-in script is the only third-party script in the app, and it loads only when Google sign-in is configured. */
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  googleScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      googleScript = null
      reject(new Error("Couldn't load Google sign-in. Check your connection and try again."))
    }
    document.head.appendChild(script)
  })
  return googleScript
}

function GoogleButton({ clientId, onCredential, onError }: { clientId: string; onCredential: (credential: string) => void; onError: (message: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    let cancelled = false
    let check: number | undefined
    loadGoogleScript()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => onCredential(r.credential) })
        ref.current.innerHTML = ''
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          // The app is in English, so the button should be too, whatever language the browser is set to.
          locale: 'en',
          width: Math.min(ref.current.clientWidth || 320, 400),
        })
        // Google draws the button itself. If nothing appears, the client id or the address is usually not set up.
        check = window.setTimeout(() => {
          if (!cancelled && ref.current && ref.current.childElementCount === 0) {
            onError(
              "Google's sign-in button didn't appear. Check that GOOGLE_CLIENT_ID is correct and that this site's address (for example http://localhost:5173) is listed under Authorised JavaScript origins for it.",
            )
          }
        }, 4000)
      })
      .catch((e: unknown) => onError(errorMessage(e)))
    return () => {
      cancelled = true
      window.clearTimeout(check)
    }
  }, [clientId, theme, onCredential, onError])

  return <div ref={ref} className="min-h-11 w-full" />
}

interface SignInOptionsProps {
  /** Called after a successful sign-in. */
  onDone?: () => void
}

/** Google sign-in, plus the labelled demo option when the server has DEMO_MODE on. */
export function SignInOptions({ onDone }: SignInOptionsProps) {
  const { config, signInWithGoogle, signInDemo } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      onDone?.()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!config) return null
  const nothing = !config.googleClientId && !config.demoMode

  return (
    <div className="grid gap-4">
      {config.googleClientId && (
        <GoogleButton
          clientId={config.googleClientId}
          onCredential={(credential) => void run(() => signInWithGoogle(credential))}
          onError={setError}
        />
      )}

      {config.demoMode && (
        <div>
          <Button variant={config.googleClientId ? 'secondary' : 'primary'} size="xl" block busy={busy} onClick={() => void run(signInDemo)}>
            Continue as demo student
          </Button>
          <p className="mt-2 text-body-sm text-muted">Demo mode. No Google account needed. You will be signed in as Aisha.</p>
        </div>
      )}

      {nothing && (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-body text-muted">
          Sign-in isn't set up on this server yet. Add a Google client ID, or turn on demo mode, in the server settings.
        </p>
      )}

      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
