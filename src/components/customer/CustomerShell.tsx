import { CalendarDays, ChevronRight, ClipboardList, Coffee, CloudSun, House, LogOut, ShoppingBag, SlidersHorizontal, User } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { cx } from '../../lib/cx'
import { useCart } from '../../state/cart'
import { useOrders } from '../../state/orders'
import { useSession } from '../../state/session'
import { Logo } from '../Logo'
import { MiniProgress } from '../OrderTracker'
import { ThemeToggle } from '../ThemeToggle'
import { useOrderCopy } from '../useOrderCopy'
import type { OrderView } from '@shared/types'

interface NavEntry {
  to: string
  label: string
  /** A shorter label for the narrow tablet rail and the phone tab bar, where the full one will not fit. */
  short?: string
  /** The full name, shown as a tooltip when the label is shortened. */
  title?: string
  icon: typeof House
  end: boolean
}

const NAV: readonly NavEntry[] = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/menu', label: 'Menu', icon: Coffee, end: false },
  { to: '/mood', label: 'Mood', title: 'What are you in the mood for?', icon: CloudSun, end: false },
  { to: '/build', label: 'Create your own', short: 'Create', title: 'Create your own coffee', icon: SlidersHorizontal, end: false },
  { to: '/orders', label: 'Orders', icon: ClipboardList, end: false },
  { to: '/events', label: 'Events', icon: CalendarDays, end: false },
  { to: '/profile', label: 'Profile', icon: User, end: false },
]

function CartLink({ className }: { className?: string }) {
  const { count } = useCart()
  if (count === 0) return null
  return (
    <Link
      to="/checkout"
      aria-label={`Your order, ${count} ${count === 1 ? 'item' : 'items'}`}
      className={cx('relative grid size-11 place-items-center rounded-md text-ink transition-colors hover:bg-raised', className)}
    >
      <ShoppingBag size={22} strokeWidth={1.75} aria-hidden="true" />
      <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-label font-semibold leading-5 text-on-accent tnum">
        {count}
      </span>
    </Link>
  )
}

function AccountControl({ compact = false }: { compact?: boolean }) {
  const { user, signOut } = useSession()
  const navigate = useNavigate()
  const location = useLocation()

  if (!user) {
    return (
      <Link
        to="/signin"
        state={{ from: location.pathname }}
        className="inline-flex min-h-11 items-center rounded-md px-3 text-body-sm font-semibold text-ink transition-colors hover:bg-raised"
      >
        Sign in
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={() => void signOut().then(() => navigate('/'))}
      aria-label={`Sign out ${user.firstName}`}
      className={cx(
        'inline-flex min-h-11 items-center gap-3 rounded-md px-3 text-body-sm font-semibold text-muted transition-colors hover:bg-raised hover:text-ink',
        compact ? 'max-w-32' : 'w-full',
      )}
    >
      <LogOut size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{compact ? user.firstName : `Sign out ${user.firstName}`}</span>
    </button>
  )
}

function OrdersBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1 text-label font-semibold leading-5 text-on-accent tnum">
      <span className="sr-only">{count} in progress, </span>
      {count}
    </span>
  )
}

function Rail() {
  const { active } = useOrders()
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-22 flex-col border-r border-line bg-surface md:flex lg:w-58">
      <div className="flex h-20 items-center justify-center lg:justify-start lg:px-6">
        <Link to="/" aria-label="Altitude home" className="rounded-md">
          <Logo variant="mark" height={34} />
        </Link>
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {NAV.map(({ to, label, short, title, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={title}
            className={({ isActive }) =>
              cx(
                'relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-2 text-body-sm font-semibold transition-colors lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3',
                isActive ? 'bg-raised text-ink' : 'text-muted hover:bg-raised hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" aria-hidden="true" />}
                <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                {short ? (
                  <span>
                    <span className="lg:hidden">{short}</span>
                    <span className="hidden lg:inline">{label}</span>
                  </span>
                ) : (
                  <span>{label}</span>
                )}
                {to === '/orders' && <OrdersBadge count={active.length} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="flex flex-col gap-1 border-t border-line p-3">
        <CartLink className="self-center lg:self-start" />
        <div className="hidden lg:block">
          <ThemeToggle withLabel className="w-full justify-start" />
        </div>
        <div className="grid place-items-center lg:hidden">
          <ThemeToggle />
        </div>
        <div className="hidden lg:block">
          <AccountControl />
        </div>
        <div className="lg:hidden">
          <AccountIcon />
        </div>
      </div>
    </aside>
  )
}

/** On the narrow rail the account control is just an icon. */
function AccountIcon() {
  const { user, signOut } = useSession()
  const navigate = useNavigate()
  if (!user) {
    return (
      <Link to="/signin" className="grid min-h-11 place-items-center rounded-md text-body-sm font-semibold text-ink hover:bg-raised">
        Sign in
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={() => void signOut().then(() => navigate('/'))}
      aria-label={`Sign out ${user.firstName}`}
      className="grid min-h-11 w-full place-items-center rounded-md text-muted transition-colors hover:bg-raised hover:text-ink"
    >
      <LogOut size={20} strokeWidth={1.75} aria-hidden="true" />
    </button>
  )
}

function PhoneHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg px-4 pt-safe md:hidden">
      <Link to="/" aria-label="Altitude home" className="rounded-md">
        <Logo variant="mark" height={30} />
      </Link>
      <div className="flex items-center gap-1">
        <CartLink />
        <ThemeToggle />
        <AccountControl compact />
      </div>
    </header>
  )
}

function TabBar() {
  const { active } = useOrders()
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe md:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${NAV.length}, minmax(0, 1fr))` }}>
        {NAV.map(({ to, label, short, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              aria-label={short ? label : undefined}
              className={({ isActive }) =>
                cx(
                  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-label font-semibold tracking-normal! transition-colors',
                  isActive ? 'text-ink' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent" aria-hidden="true" />}
                  <span className="relative">
                    <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                    {to === '/orders' && active.length > 0 && (
                      <span className="absolute -top-1.5 -right-3">
                        <OrdersBadge count={active.length} />
                      </span>
                    )}
                  </span>
                  {short ?? label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Stays under the header on every screen while an order is in progress, so the answer is never a tap away. */
function MiniTracker() {
  const { active } = useOrders()
  const { pathname } = useLocation()
  const latest = active[0]
  if (!latest) return null
  if (pathname === `/orders/${latest.id}` || (active.length > 1 && pathname === '/orders')) return null
  return <MiniTrackerBar order={latest} extra={active.length - 1} />
}

function MiniTrackerBar({ order, extra }: { order: OrderView; extra: number }) {
  const copy = useOrderCopy(order)
  const to = extra > 0 ? '/orders' : `/orders/${order.id}`
  const summary = [copy.headline, copy.detail].filter(Boolean).join(' ')
  return (
    <Link
      to={to}
      className="sticky top-14 z-20 flex min-h-14 items-center gap-3 border-b border-line bg-surface px-4 py-2 shadow-band md:top-0 md:px-8"
    >
      <span className="font-display text-headline font-semibold leading-none tnum">#{order.number}</span>
      <span className="min-w-0 flex-1 truncate text-body-sm text-ink">
        {summary}
        {extra > 0 && <span className="text-muted"> +{extra} more</span>}
      </span>
      <MiniProgress status={order.status} />
      <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden="true" />
    </Link>
  )
}

export function CustomerShell() {
  return (
    <div className="min-h-dvh">
      <Rail />
      <div className="md:pl-22 lg:pl-58">
        <PhoneHeader />
        <MiniTracker />
        <main id="main" className="mx-auto w-full max-w-[110rem] px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-14 lg:px-10 2xl:px-14">
          <Outlet />
        </main>
      </div>
      <TabBar />
    </div>
  )
}
