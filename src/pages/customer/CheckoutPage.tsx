import { formatAedNumber } from '@shared/money'
import { aheadPhrase, minutesPhrase } from '@shared/orderFlow'
import type { CreateOrderInput, OrderView, QuoteResponse } from '@shared/types'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { CartLines } from '../../components/cart/CartLines'
import { CardForm } from '../../components/checkout/CardForm'
import { SignInOptions } from '../../components/SignInOptions'
import { DrawnCheck, LoadingLine } from '../../components/ui/Art'
import { Button, LinkButton } from '../../components/ui/Button'
import { ChoiceGroup, TextField } from '../../components/ui/Fields'
import { Price } from '../../components/ui/Price'
import { EmptyState } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import { api, errorMessage } from '../../lib/api'
import { validateCard, type CardErrors, type CardFields } from '../../lib/card'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useCart, type CartLine } from '../../state/cart'
import { useOrders } from '../../state/orders'
import { useSession } from '../../state/session'

type Stage = 'idle' | 'processing' | 'success'
const EMPTY_CARD: CardFields = { name: '', number: '', expiry: '', cvc: '' }
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

/** The server's own price and time for this cart. The page shows these, not its local sums. */
function useQuote(lines: CartLine[]) {
  const orderable = useMemo(
    () =>
      lines
        .filter((l) => !l.problem && l.item)
        .map((l) => ({ itemId: l.itemId, quantity: l.quantity, selections: l.selections, note: l.note || undefined })),
    [lines],
  )
  const key = JSON.stringify(orderable)
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (orderable.length === 0) {
      setQuote(null)
      setError(null)
      return
    }
    let cancelled = false
    const load = () =>
      api<QuoteResponse>('/orders/quote', { body: { lines: orderable } })
        .then((q) => {
          if (cancelled) return
          setQuote(q)
          setError(null)
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(errorMessage(e))
        })
    const first = window.setTimeout(load, 150)
    const refresh = window.setInterval(load, 20_000)
    return () => {
      cancelled = true
      window.clearTimeout(first)
      window.clearInterval(refresh)
    }
    // `key` is the serialised `orderable`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { quote, error, orderable }
}

function PaymentOverlay({ stage, method }: { stage: Exclude<Stage, 'idle'>; method: 'card' | 'cash' }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg px-6" role="status" aria-live="assertive">
      <div className="flex w-full max-w-xs flex-col items-center gap-6 text-center">
        {stage === 'processing' ? (
          <>
            <LoadingLine label={method === 'card' ? 'Processing payment' : 'Placing your order'} />
            <p className="text-headline font-semibold">{method === 'card' ? 'Processing payment' : 'Placing your order'}</p>
          </>
        ) : (
          <>
            <DrawnCheck size={88} />
            <p className="text-headline font-semibold">Paid. Your order is in.</p>
          </>
        )}
      </div>
    </div>
  )
}

export function CheckoutPage() {
  useDocumentTitle('Your order')
  const cart = useCart()
  const { user } = useSession()
  const orders = useOrders()
  const toast = useToast()
  const navigate = useNavigate()

  const [fulfilment, setFulfilment] = useState<'takeaway' | 'dinein'>('takeaway')
  const [table, setTable] = useState('')
  const [method, setMethod] = useState<'card' | 'cash'>('card')
  const [card, setCard] = useState<CardFields>(EMPTY_CARD)
  const [cardErrors, setCardErrors] = useState<CardErrors>({})
  const [tableError, setTableError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')

  const { quote, error: quoteError } = useQuote(cart.lines)
  const total = quote?.totalFils ?? cart.totalFils
  const busy = stage !== 'idle'
  const canOrder = cart.count > 0 && !cart.hasProblems && !quoteError

  // Once the order is placed the cart empties; keep the overlay up instead of flashing the empty state.
  if (cart.lines.length === 0 && stage === 'idle') {
    return (
      <div className="max-w-2xl">
        <h1 className="text-display-lg font-bold">Your order</h1>
        <EmptyState
          className="mt-6"
          title="Your order is empty"
          action={<LinkButton to="/menu">Browse the menu</LinkButton>}
        >
          Add a drink or something to eat and it will wait here for you.
        </EmptyState>
      </div>
    )
  }

  const submit = async () => {
    if (!user || busy || !canOrder) return
    setSubmitError(null)

    let valid = true
    if (fulfilment === 'dinein' && !/^[A-Za-z0-9-]{1,6}$/.test(table.trim())) {
      setTableError('Add your table number, up to 6 letters or numbers.')
      valid = false
    } else {
      setTableError(null)
    }
    if (method === 'card') {
      const errors = validateCard(card)
      setCardErrors(errors)
      if (Object.keys(errors).length > 0) valid = false
    }
    if (!valid) {
      toast.show('Check the highlighted fields.', 'error')
      return
    }

    // Card data stops here. The request below says "card" and nothing more.
    const body: CreateOrderInput = {
      lines: cart.lines.filter((l) => !l.problem).map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        selections: l.selections,
        note: l.note || undefined,
      })),
      fulfilment,
      tableNumber: fulfilment === 'dinein' ? table.trim().toUpperCase() : undefined,
      paymentMethod: method,
    }

    setStage('processing')
    try {
      const [response] = await Promise.all([
        api<{ order: OrderView }>('/orders', { body }),
        method === 'card' ? wait(1300) : wait(350),
      ])
      orders.upsert(response.order)
      cart.clear()
      setCard(EMPTY_CARD)
      if (method === 'card') {
        setStage('success')
        await wait(1000)
      }
      navigate(`/orders/${response.order.id}`, { replace: true, state: { justPlaced: true } })
    } catch (e) {
      setStage('idle')
      setSubmitError(errorMessage(e))
      toast.show(errorMessage(e), 'error')
    }
  }

  const eta =
    quote && cart.count > 0
      ? `${aheadPhrase(quote.ahead)}. ${minutesPhrase(Math.max(1, Math.round(quote.etaSeconds / 60)))}.`
      : null

  const payLabel = method === 'card' ? `Pay ${formatAedNumber(total)} AED` : 'Place order'

  const action = !user ? (
    <div>
      <h3 className="text-title font-semibold">Sign in to place your order</h3>
      <p className="mt-1 mb-4 text-body-sm text-muted">Your order is saved on this device. It will be here when you're back.</p>
      <SignInOptions />
    </div>
  ) : (
    <div>
      {(quoteError || submitError) && (
        <p role="alert" className="mb-3 flex items-start gap-2 text-body-sm text-danger">
          <TriangleAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
          {submitError ?? quoteError}
        </p>
      )}
      <Button size="xl" block busy={busy} disabled={!canOrder} onClick={() => void submit()}>
        {payLabel}
      </Button>
      {method === 'cash' && <p className="mt-2 text-body-sm text-muted">Pay at the counter to start your order.</p>}
      {cart.hasProblems && <p className="mt-2 text-body-sm text-danger">Remove the unavailable items to continue.</p>}
    </div>
  )

  return (
    <>
      {stage !== 'idle' && <PaymentOverlay stage={stage} method={method} />}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_23.75rem] lg:items-start lg:gap-12">
        <div className="min-w-0 pb-28 lg:pb-0">
          <h1 className="text-display-lg font-bold">Your order</h1>

          <section aria-labelledby="lines-heading" className="mt-6">
            <h2 id="lines-heading" className="sr-only">
              Items
            </h2>
            <CartLines />
            <div className="mt-5 flex items-center justify-between border-t border-line pt-4 lg:hidden">
              <span className="text-title font-semibold">Total</span>
              <Price fils={total} size="lg" />
            </div>
          </section>

          <section aria-labelledby="fulfilment-heading" className="mt-8 border-t border-line pt-6">
            <h2 id="fulfilment-heading" className="mb-4 text-headline font-semibold">
              Where will you have it?
            </h2>
            <ChoiceGroup
              legend="Take-away or dine-in"
              type="radio"
              name="fulfilment"
              layout="split"
              value={[fulfilment]}
              onChange={([v]) => setFulfilment(v as 'takeaway' | 'dinein')}
              choices={[
                { value: 'takeaway', label: 'Take-away' },
                { value: 'dinein', label: 'Dine-in' },
              ]}
            />
            {fulfilment === 'dinein' && (
              <TextField
                className="mt-4 max-w-56"
                label="Table number"
                value={table}
                onChange={(e) => setTable(e.target.value.toUpperCase())}
                error={tableError}
                helper="So we know where to bring it."
                maxLength={6}
                autoComplete="off"
                disabled={busy}
              />
            )}
          </section>

          <section aria-labelledby="when-heading" className="mt-8 border-t border-line pt-6">
            <h2 id="when-heading" className="mb-2 text-headline font-semibold">
              When
            </h2>
            <p className="text-title font-semibold">As soon as possible</p>
            <p className="mt-1 text-body text-muted" aria-live="polite">
              {eta ?? 'Working out your wait...'}
            </p>
          </section>

          <section aria-labelledby="payment-heading" className="mt-8 border-t border-line pt-6">
            <h2 id="payment-heading" className="mb-4 text-headline font-semibold">
              Payment
            </h2>
            <ChoiceGroup
              legend="How do you want to pay?"
              type="radio"
              name="payment"
              layout="split"
              value={[method]}
              onChange={([v]) => setMethod(v as 'card' | 'cash')}
              choices={[
                { value: 'card', label: 'Card' },
                { value: 'cash', label: 'Pay at counter' },
              ]}
            />
            <div className="mt-5">
              {method === 'card' ? (
                <CardForm fields={card} errors={cardErrors} onChange={setCard} disabled={busy} />
              ) : (
                <p className="text-body text-muted">
                  We'll take your order now, and start making it when you pay at the counter. Your wait begins then.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Tablet and laptop: the total and the button stay beside the form. */}
        <aside className="sticky top-8 hidden rounded-lg border border-line bg-surface p-5 lg:block" aria-label="Order total">
          <div className="flex items-center justify-between">
            <span className="text-title font-semibold">Total</span>
            <Price fils={total} size="xl" />
          </div>
          {eta && <p className="mt-2 text-body-sm text-muted">{eta}</p>}
          <div className="mt-5">{action}</div>
        </aside>
      </div>

      {/* Phone and tablet: pinned to the bottom, within thumb reach. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface px-4 pt-3 pb-3 md:bottom-0 md:left-22 md:px-8 lg:hidden">
        <div className="mx-auto max-w-2xl">{!user ? <SignInPrompt /> : action}</div>
      </div>
    </>
  )
}

/** On a phone the bar is short, so signing in moves to its own screen. */
function SignInPrompt() {
  return (
    <LinkButton to="/signin" state={{ from: '/checkout' }} size="xl" block>
      Sign in to order
    </LinkButton>
  )
}
