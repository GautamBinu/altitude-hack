import { Navigate, useLocation, useNavigate } from 'react-router'
import { Logo } from '../../components/Logo'
import { SignInOptions } from '../../components/SignInOptions'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useSession } from '../../state/session'

export function SignInPage() {
  useDocumentTitle('Sign in')
  const { user } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (user) return <Navigate to={from} replace />

  return (
    <div className="mx-auto max-w-md pt-2 md:pt-10">
      {/* The full logo, on a solid brand panel with clear space around it. */}
      <div className="grid place-items-center rounded-lg bg-navy py-8">
        <Logo variant="full" height={136} tone="cream" />
      </div>
      <h1 className="mt-8 text-display-lg font-bold">Sign in to order</h1>
      <p className="mt-2 mb-6 text-body text-muted">Browse as a guest any time. Sign in to place an order and follow it live.</p>
      <SignInOptions onDone={() => navigate(from, { replace: true })} />
    </div>
  )
}
