import { ChevronRight, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { LoyaltyCard } from '../../components/loyalty/LoyaltyCard'
import { SignInOptions } from '../../components/SignInOptions'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Button } from '../../components/ui/Button'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useLoyalty } from '../../state/loyalty'
import { useSession } from '../../state/session'

/** A plain rounded-square frame with the first letter. No made-up shield, no photo dependence. */
function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-14 shrink-0 place-items-center rounded-lg border border-control font-display text-headline font-semibold text-ink"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function ProfilePage() {
  useDocumentTitle('Profile')
  const { user, signOut } = useSession()
  const { summary } = useLoyalty()
  const navigate = useNavigate()

  if (!user) {
    return (
      <div className="max-w-md">
        <h1 className="text-display-lg font-bold">Profile</h1>
        <p className="mt-2 mb-6 text-body text-muted">Sign in to see your points, favourites and past orders.</p>
        <SignInOptions />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-display-lg font-bold">Profile</h1>

      <div className="mt-6 flex items-center gap-4">
        <Avatar name={user.firstName} />
        <div className="min-w-0">
          <p className="truncate text-title font-semibold leading-snug">{user.name}</p>
          <p className="truncate text-body-sm text-muted">{user.isDemo ? 'Demo student account' : (user.email ?? '')}</p>
        </div>
      </div>

      {summary && (
        <div className="mt-8">
          <LoyaltyCard summary={summary} />
        </div>
      )}

      <nav aria-label="Your things" className="mt-8 divide-y divide-line border-y border-line">
        <Link to="/loyalty" className="flex min-h-14 items-center justify-between gap-4 text-body font-semibold hover:text-accent">
          Rewards and points history
          <ChevronRight size={18} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
        </Link>
        <Link to="/orders" className="flex min-h-14 items-center justify-between gap-4 text-body font-semibold hover:text-accent">
          Past orders
          <ChevronRight size={18} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
        </Link>
      </nav>

      <section aria-labelledby="appearance" className="mt-8">
        <h2 id="appearance" className="mb-2 text-headline font-semibold">
          Appearance
        </h2>
        <ThemeToggle withLabel className="-ml-3" />
      </section>

      <Button
        variant="secondary"
        size="lg"
        className="mt-10"
        onClick={() => void signOut().then(() => navigate('/'))}
      >
        <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
        Sign out
      </Button>
    </div>
  )
}
