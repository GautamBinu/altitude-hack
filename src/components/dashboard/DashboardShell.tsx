import { ClipboardList, LogOut, Megaphone, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { NavLink, Navigate, Outlet } from 'react-router'
import { cx } from '../../lib/cx'
import { useStaff } from '../../state/staff'
import { Logo } from '../Logo'
import { Splash } from '../Splash'
import { ThemeToggle } from '../ThemeToggle'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Baristas run the counter, so management screens are for admins. */
  adminOnly?: boolean
  end?: boolean
}

/** Only screens that exist are listed. Others are added as they are built. */
const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Orders', icon: ClipboardList, end: true },
  { to: '/dashboard/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/dashboard/promotions', label: 'Promos', icon: Megaphone, adminOnly: true },
]

export function DashboardShell() {
  const { status, user, logout } = useStaff()
  if (status === 'loading') return <Splash />
  if (!user) return <Navigate to="/dashboard/login" replace />

  const items = NAV.filter((n) => !n.adminOnly || user.role === 'admin')

  return (
    <div className="min-h-dvh">
      {/* Counter tablet and laptop: a slim rail. */}
      <aside data-chrome className="fixed inset-y-0 left-0 z-30 hidden w-22 flex-col border-r border-line bg-surface md:flex">
        <div className="grid h-20 place-items-center">
          <Logo variant="mark" height={34} />
        </div>
        <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
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

      {/* Phone and portrait tablet: a compact top bar and a bottom bar for the screens. */}
      <header data-chrome className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg px-4 pt-safe md:hidden">
        <Logo variant="mark" height={30} />
        <div className="flex items-center gap-1">
          <span className="mr-1 text-body-sm text-muted">{user.displayName}</span>
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
      <nav data-chrome aria-label="Dashboard" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe md:hidden">
        <ul className="flex overflow-x-auto [scrollbar-width:none]">
          {items.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="min-w-20 flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx('relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-body-sm font-semibold transition-colors', isActive ? 'text-ink' : 'text-muted')
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-accent" aria-hidden="true" />}
                    <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main id="main" className="px-4 pt-5 pb-24 md:pl-[calc(5.5rem+1.5rem)] md:pr-6 md:pt-6 md:pb-12">
        <Outlet />
      </main>
    </div>
  )
}
