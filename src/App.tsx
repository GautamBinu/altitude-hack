import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router'
import { CustomerShell } from './components/customer/CustomerShell'
import { AdminOnly } from './components/dashboard/AdminOnly'
import { DashboardShell } from './components/dashboard/DashboardShell'
import { Splash } from './components/Splash'
import { LoadingLine } from './components/ui/Art'
import { Button } from './components/ui/Button'
import { ErrorState } from './components/ui/States'
import { ToastProvider } from './components/ui/Toast'
import { NotFoundPage } from './pages/NotFoundPage'
import { CheckoutPage } from './pages/customer/CheckoutPage'
import { HomePage } from './pages/customer/HomePage'
import { LoyaltyPage } from './pages/customer/LoyaltyPage'
import { ProfilePage } from './pages/customer/ProfilePage'
import { MenuPage } from './pages/customer/MenuPage'
import { BuilderPage } from './pages/customer/BuilderPage'
import { EventPage } from './pages/customer/EventPage'
import { EventsPage } from './pages/customer/EventsPage'
import { SubmitEventPage } from './pages/customer/SubmitEventPage'
import { MoodPage } from './pages/customer/MoodPage'
import { OrderPage } from './pages/customer/OrderPage'
import { OrdersPage } from './pages/customer/OrdersPage'
import { SignInPage } from './pages/customer/SignInPage'
import { MenuManagerPage } from './pages/dashboard/MenuManagerPage'
import { ModerationPage } from './pages/dashboard/ModerationPage'
import { PromotionsPage } from './pages/dashboard/PromotionsPage'
import { QueuePage } from './pages/dashboard/QueuePage'
import { StaffLoginPage } from './pages/dashboard/StaffLoginPage'
import { BuilderProvider } from './state/builder'
import { CartProvider } from './state/cart'
import { LoyaltyProvider } from './state/loyalty'
import { MenuProvider } from './state/menu'
import { OrdersProvider } from './state/orders'
import { SessionProvider, useSession } from './state/session'
import { StaffProvider } from './state/staff'

// The charts library is large and only admins use it, so it loads when the Statistics screen is opened.
const StatsPage = lazy(() => import('./pages/dashboard/StatsPage').then((m) => ({ default: m.StatsPage })))

/** Everything the customer app shares: who is signed in, the menu, the cart and live orders. */
function CustomerApp() {
  const session = useSession()
  if (session.status === 'loading') return <Splash />
  if (session.status === 'error') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState message={session.error ?? ''} offline={session.offline} onRetry={session.reload} title="Altitude didn't load" />
      </div>
    )
  }
  return (
    <MenuProvider>
      <BuilderProvider>
        <CartProvider>
          <OrdersProvider>
            <LoyaltyProvider>
              <CustomerShell />
            </LoyaltyProvider>
          </OrdersProvider>
        </CartProvider>
      </BuilderProvider>
    </MenuProvider>
  )
}

function CustomerRoot() {
  return (
    <SessionProvider>
      <CustomerApp />
    </SessionProvider>
  )
}

function DashboardRoot() {
  return (
    <StaffProvider>
      <Outlet />
    </StaffProvider>
  )
}

/** Last line of defence: a calm screen instead of a blank page. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] render error', error, info.componentStack)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState title="Something broke on our side" message="Reloading usually clears it. Your order is safe." />
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    )
  }
}

export function App() {
  return (
    <Boundary>
      <ToastProvider>
        <BrowserRouter>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-3 focus:text-on-accent"
          >
            Skip to content
          </a>
          <Routes>
            <Route element={<CustomerRoot />}>
              <Route index element={<HomePage />} />
              <Route path="menu" element={<MenuPage />} />
              <Route path="mood" element={<MoodPage />} />
              <Route path="build" element={<BuilderPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="events/new" element={<SubmitEventPage />} />
              <Route path="events/:id" element={<EventPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:id" element={<OrderPage />} />
              <Route path="loyalty" element={<LoyaltyPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="signin" element={<SignInPage />} />
            </Route>

            <Route path="dashboard" element={<DashboardRoot />}>
              <Route path="login" element={<StaffLoginPage />} />
              <Route element={<DashboardShell />}>
                <Route index element={<QueuePage />} />
                <Route path="menu" element={<MenuManagerPage />} />
                <Route
                  path="stats"
                  element={
                    <AdminOnly>
                      <Suspense
                        fallback={
                          <div role="status" className="mt-8">
                            <LoadingLine label="Loading statistics" />
                          </div>
                        }
                      >
                        <StatsPage />
                      </Suspense>
                    </AdminOnly>
                  }
                />
                <Route path="promotions" element={<AdminOnly><PromotionsPage /></AdminOnly>} />
                <Route path="review" element={<AdminOnly><ModerationPage /></AdminOnly>} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </Boundary>
  )
}
