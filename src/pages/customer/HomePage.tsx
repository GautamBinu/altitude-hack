import type { MenuItem } from '@shared/types'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { DrinkOfMonth } from '../../components/home/DrinkOfMonth'
import { PopularList } from '../../components/home/PopularList'
import { Banners, BuildEntry, EventsPreview, MoodEntry, ReorderSection } from '../../components/home/Sections'
import { LoyaltyCard } from '../../components/loyalty/LoyaltyCard'
import { Logo } from '../../components/Logo'
import { ItemSheet } from '../../components/menu/ItemSheet'
import { OrderStatusPanel } from '../../components/orders/OrderStatusPanel'
import { LinkButton } from '../../components/ui/Button'
import { ErrorState } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import { greetingFor } from '../../lib/format'
import { reorder, selectionsFor } from '../../lib/reorder'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useCart } from '../../state/cart'
import { useHome, useUsual } from '../../state/home'
import { useLoyalty } from '../../state/loyalty'
import { useMenu } from '../../state/menu'
import { useOrders } from '../../state/orders'
import { useQueueStatus, waitSentence } from '../../state/queueStatus'
import { useSession } from '../../state/session'

/** The full logo on solid navy, with the shop's line once. Laptop and wider. */
function BrandPanel() {
  return (
    <div className="hidden overflow-hidden rounded-lg bg-navy lg:block">
      <div className="grid place-items-center px-6 pt-10 pb-6">
        <Logo variant="full" height={150} tone="cream" />
      </div>
      <p className="px-6 pb-6 text-center font-display text-headline font-semibold tracking-wide text-cream">Elevate your experiences</p>
      <div aria-hidden="true" className="dimple h-16 [mask-image:linear-gradient(to_top,black,transparent)]" />
    </div>
  )
}

/** A slimmer version for tablets, across the top. */
function BrandBand() {
  return (
    <div className="hidden items-center gap-6 rounded-lg bg-navy px-6 py-4 md:flex lg:hidden">
      <Logo variant="full" height={84} tone="cream" />
      <p className="font-display text-headline font-semibold tracking-wide text-cream">Elevate your experiences</p>
    </div>
  )
}

export function HomePage() {
  useDocumentTitle()
  const { user } = useSession()
  const { active, orders } = useOrders()
  const { summary } = useLoyalty()
  const { itemsById } = useMenu()
  const cart = useCart()
  const toast = useToast()
  const navigate = useNavigate()
  const queue = useQueueStatus()
  const { state: home, reload } = useHome()
  const usual = useUsual(user?.id ?? null, orders.map((o) => `${o.id}:${o.status}`).join('|'))
  const [selected, setSelected] = useState<MenuItem | null>(null)

  const orderUsual = () => {
    if (!usual?.usual) return
    const item = itemsById.get(usual.usual.itemId)
    if (!item) return
    cart.add(item, selectionsFor(item, usual.usual.selections), usual.usual.note ?? '', 1)
    navigate('/checkout')
  }
  const orderLast = () => {
    if (!usual?.last) return
    const { added, skipped } = reorder(usual.last.lines, itemsById, cart)
    if (added === 0) {
      toast.show("Those items aren't available right now.", 'error')
      return
    }
    if (skipped > 0) toast.show(`${skipped} item${skipped === 1 ? ' is' : 's are'} no longer available and was left out.`)
    navigate('/checkout')
  }

  const dotm = home.status === 'ready' ? home.data.drinkOfMonth : null
  const dotmItem = dotm?.itemId != null ? (itemsById.get(dotm.itemId) ?? null) : null

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="grid content-start gap-10 lg:col-span-8">
        <BrandBand />

        <header>
          <h1 className="text-display-xl font-bold text-ink">
            {user ? `${greetingFor()}, ${user.firstName}.` : 'Order ahead at Altitude.'}
          </h1>
          <p className="mt-3 max-w-md text-title text-muted">
            {user ? 'What can we get you?' : 'Choose your drink, pay, and watch it move up the queue. No standing in line.'}
          </p>
          {queue && <p className="mt-5 text-body text-ink">{waitSentence(queue)}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <LinkButton to="/menu" size="xl">
              Order a drink
            </LinkButton>
            {!user && (
              <LinkButton to="/signin" variant="secondary" size="xl">
                Sign in
              </LinkButton>
            )}
          </div>
        </header>

        {active.length > 0 && (
          <section aria-labelledby="home-active" className="grid gap-4">
            <h2 id="home-active" className="text-headline font-semibold">
              {active.length === 1 ? 'Your order' : 'Your orders'}
            </h2>
            {active.slice(0, 2).map((order) => (
              <OrderStatusPanel key={order.id} order={order} linked />
            ))}
          </section>
        )}

        {home.status === 'error' && (
          <ErrorState title="Some of this didn't load" message={home.message} offline={home.offline} onRetry={reload} />
        )}

        <MoodEntry />
        <BuildEntry />

        {dotm && <DrinkOfMonth promo={dotm} item={dotmItem} onOrder={setSelected} />}

        {home.status === 'ready' && <PopularList popular={home.data.popular} itemsById={itemsById} onOpen={setSelected} />}

        {usual && <ReorderSection usual={usual} itemsById={itemsById} onOrderUsual={orderUsual} onOrderLast={orderLast} />}
      </div>

      <aside className="grid content-start gap-8 lg:col-span-4" aria-label="Your account and what is on">
        <BrandPanel />

        {user && summary ? (
          <LoyaltyCard summary={summary} />
        ) : (
          !user && (
            <section aria-labelledby="guest-loyalty" className="rounded-lg border border-line bg-surface p-5">
              <h2 id="guest-loyalty" className="text-headline font-semibold">
                Earn a point for every dirham
              </h2>
              <p className="mt-2 text-body text-muted">Climb from Bronze to Platinum and spend points on rewards at checkout.</p>
              <Link to="/signin" className="mt-4 inline-flex min-h-11 items-center text-body font-semibold text-ink underline underline-offset-4">
                Sign in to start climbing
              </Link>
            </section>
          )
        )}

        {home.status === 'ready' && (
          <>
            <Banners banners={home.data.banners} itemsById={itemsById} onOrder={setSelected} />
            <EventsPreview events={home.data.events} />
          </>
        )}
      </aside>

      <ItemSheet item={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
