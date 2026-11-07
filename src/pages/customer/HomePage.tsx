import { Logo } from '../../components/Logo'
import { OrderStatusPanel } from '../../components/orders/OrderStatusPanel'
import { LinkButton } from '../../components/ui/Button'
import { greetingFor } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useOrders } from '../../state/orders'
import { useQueueStatus, waitSentence } from '../../state/queueStatus'
import { useSession } from '../../state/session'

/** The brand panel: the full logo on solid navy, the shop's line once, a hint of the oak dimple pattern. */
function BrandPanel() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg bg-navy">
      <div className="grid place-items-center px-6 pt-12 pb-8 md:pt-16">
        <Logo variant="full" height={176} tone="cream" />
      </div>
      <p className="px-6 pb-6 text-center font-display text-headline font-semibold tracking-wide text-cream">
        Elevate your experiences
      </p>
      {/* The oak dimple pattern, kept to its own strip so it never sits behind the logo or the words. */}
      <div aria-hidden="true" className="dimple h-20 [mask-image:linear-gradient(to_top,black,transparent)] md:h-28" />
    </div>
  )
}

export function HomePage() {
  useDocumentTitle()
  const { user } = useSession()
  const { active, orders } = useOrders()
  const queue = useQueueStatus()

  return (
    <div className="grid gap-10 md:grid-cols-12 md:items-center md:gap-10 lg:gap-14 md:min-h-[calc(100dvh-8rem)]">
      <div className="md:col-span-7">
        <h1 className="text-display-xl font-bold text-ink">
          {user ? `${greetingFor()}, ${user.firstName}.` : 'Order ahead at Altitude.'}
        </h1>
        <p className="mt-3 max-w-md text-title text-muted">
          {user
            ? 'What can we get you?'
            : 'Choose your drink, pay, and watch it move up the queue. No standing in line.'}
        </p>

        {queue && <p className="mt-6 text-body text-ink">{waitSentence(queue)}</p>}

        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton to="/menu" size="xl">
            Order a drink
          </LinkButton>
          {!user ? (
            <LinkButton to="/signin" variant="secondary" size="xl">
              Sign in
            </LinkButton>
          ) : orders.length > 0 ? (
            <LinkButton to="/orders" variant="secondary" size="xl">
              Your orders
            </LinkButton>
          ) : null}
        </div>

        {active.length > 0 && (
          <section aria-labelledby="home-active" className="mt-10 grid gap-4">
            <h2 id="home-active" className="text-headline font-semibold">
              {active.length === 1 ? 'Your order' : 'Your orders'}
            </h2>
            {active.slice(0, 2).map((order) => (
              <OrderStatusPanel key={order.id} order={order} linked />
            ))}
          </section>
        )}
      </div>

      <div className="md:col-span-5">
        <BrandPanel />
      </div>
    </div>
  )
}
