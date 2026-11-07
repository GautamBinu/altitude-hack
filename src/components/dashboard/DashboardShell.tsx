import { ClipboardList, LogOut } from 'lucide-react'
import { NavLink, Navigate, Outlet } from 'react-router'
import { cx } from '../../lib/cx'
import { useStaff } from '../../state/staff'
import { Logo } from '../Logo'
import { Splash } from '../Splash'
import { ThemeToggle } from '../ThemeToggle'

/** Only the Orders screen exists in this phase, so it is the only destination. */
const NAV = [{ to: '/dashboard', label: 'Orders', icon: ClipboardList }] as const

export function DashboardShell() {
  const { status, user, logout } = useStaff()
  if (status === 'loading') return <Splash />
  if (!user) return <Navigate to="/dashboard/login" replace />

  return (
    <div className="min-h-dvh">
      {/* Counter tablet and laptop: a slim rail. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-22 flex-col border-r border-line bg-surface md:flex">
        <div className="grid h-20 place-items-center">
          <Logo variant="mark" height={34} />
        </div>
        <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                cx(
                  'relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-md text-body-sm font-semibold transition-colors',
                  isActive ? 'bg-raised text-ink' : 'text-muted hover:bg-raised hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" aria-hidden="true" />}
                  <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-1 border-t border-line p-3">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void logout()}
            aria-label={`Sign out ${user.displayName}`}
            className="grid size-11 place-items-center rounded-md text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <LogOut size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* Phone: a compact top bar. */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg px-4 pt-safe md:hidden">
        <div className="flex items-center gap-3">
          <Logo variant="mark" height={30} />
          <span className="text-title font-semibold">Orders</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void logout()}
            aria-label={`Sign out ${user.displayName}`}
            className="grid size-11 place-items-center rounded-md text-muted hover:bg-raised hover:text-ink"
          >
            <LogOut size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="main" className="px-4 pt-5 pb-12 md:pl-[calc(5.5rem+1.5rem)] md:pr-6 md:pt-6">
        <Outlet />
      </main>
    </div>
  )
}
