import { formatAedNumber } from '@shared/money'
import { aheadPhrase, clockLabel, minutesPhrase } from '@shared/orderFlow'
import type { CreateOrderInput, OrderView, QuoteResponse } from '@shared/types'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CartLines } from '../../components/cart/CartLines'
import { CardForm } from '../../components/checkout/CardForm'
import { SlotPicker } from '../../components/checkout/SlotPicker'
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
import { useLoyalty } from '../../state/loyalty'
import { useSlots } from '../../state/slots'
import { useOrders } from '../../state/orders'
import { useSession } from '../../state/session'

type Stage = 'idle' | 'processing' | 'success'
const EMPTY_CARD: CardFields = { name: '', number: '', expiry: '', cvc: '' }
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

/** The server's own price and time for this cart. The page shows these, not its local sums. */
function useQuote(lines: CartLine[], rewardId: string | null, code: string | null, pickupAt: string | null) {
  const orderable = useMemo(
    () =>
      lines
        .filter((l) => !l.problem && l.item)
        .map((l) => ({ itemId: l.itemId, quantity: l.quantity, selections: l.selections, note: l.note || undefined })),
    [lines],
  )
  const key = JSON.stringify({ orderable, rewardId, code, pickupAt })
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
      api<QuoteResponse>('/orders/quote', { body: { lines: orderable, rewardId: rewardId ?? undefined, code: code ?? undefined, pickupAt: pickupAt ?? undefined } })
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

/** Subtotal, anything taken off, and the total. Only shows the rows that apply. */
function Breakdown({ quote, total }: { quote: QuoteResponse | null; total: number }) {
  const rows: { label: string; fils: number; negative?: boolean }[] = []
  if (quote && (quote.rewardFils > 0 || quote.codeFils > 0 || quote.passFils > 0)) {
    rows.push({ label: 'Subtotal', fils: quote.subtotalFils })
    if (quote.passFils > 0) rows.push({ label: 'Summit Box', fils: quote.passFils, negative: true })
    if (quote.codeFils > 0) rows.push({ label: 'Discount code', fils: quote.codeFils, negative: true })
    if (quote.rewardFils > 0) rows.push({ label: 'Reward', fils: quote.rewardFils, negative: true })
  }
  return (
    <div>
      {rows.length > 0 && (
        <dl className="mb-3 grid gap-1.5 text-body-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between">
              <dt className="text-muted">{row.label}</dt>
              <dd className="text-ink tnum">
                {row.negative ? '-' : ''}
                {formatAedNumber(row.fils)} AED
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex items-center justify-between">
        <span className="text-title font-semibold">Total</span>
        <Price fils={total} size="xl" />
      </div>
      {quote && quote.pointsToEarn > 0 && (
        <p className="mt-2 text-body-sm text-muted tnum">You'll earn {quote.pointsToEarn.toLocaleString('en-US')} points when you collect it.</p>
      )}
    </div>
  )
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

  const loyalty = useLoyalty()
  const [rewardId, setRewardId] = useState<string | null>(null)
  const [codeText, setCodeText] = useState('')
  const [appliedCode, setAppliedCode] = useState<string | null>(null)
  const [when, setWhen] = useState<'asap' | 'later'>('asap')
  const [pickupAt, setPickupAt] = useState<string | null>(null)
  const { slots, error: slotsError } = useSlots(when === 'later')
  const { quote, error: quoteError } = useQuote(cart.lines, user ? rewardId : null, appliedCode, when === 'later' ? pickupAt : null)
  const needsTime = when === 'later' && !pickupAt
  // A slot that has filled or passed while the customer was deciding shows up as a notice from the server.
  const slotNotice = when === 'later' && pickupAt ? quote?.notices.find((n) => /time|slot|open|day/i.test(n)) : undefined
  // The server says whether a typed code works. If it does not, the code is cleared and the reason is shown.
  const codeNotice = appliedCode && quote && quote.codeFils === 0 ? quote.notices.find((n) => /code/i.test(n)) : undefined
  const total = quote?.totalFils ?? cart.totalFils
  const busy = stage !== 'idle'
  const canOrder = cart.count > 0 && !cart.hasProblems && !quoteError && !needsTime && !slotNotice

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
      rewardId: rewardId ?? undefined,
      code: appliedCode ?? undefined,
      pickupAt: when === 'later' ? (pickupAt ?? undefined) : undefined,
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

  const behindMinutes =
    when === 'later' && pickupAt && quote?.readyAt ? Math.round((Date.parse(quote.readyAt) - Date.parse(pickupAt)) / 60000) : 0
  const eta =
    when === 'later'
      ? pickupAt && quote?.readyAt
        ? behindMinutes > 1
          ? `Pickup at ${clockLabel(pickupAt)}. It's busy, so it may be ready ${behindMinutes} minutes late.`
          : `Ready at ${clockLabel(pickupAt)}.`
        : null
      : quote && cart.count > 0
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
        {needsTime ? 'Pick a time to continue' : payLabel}
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
            <div className="mt-5 border-t border-line pt-4 lg:hidden">
              <Breakdown quote={quote} total={total} />
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

          {user && loyalty.summary && (
            <section aria-labelledby="reward-heading" className="mt-8 border-t border-line pt-6">
              <h2 id="reward-heading" className="mb-1 text-headline font-semibold">
                Use your points
              </h2>
              <p className="mb-4 text-body-sm text-muted tnum">
                You have {loyalty.summary.balance.toLocaleString('en-US')} points. <Link to="/loyalty" className="font-semibold text-ink underline underline-offset-4">See rewards</Link>
              </p>
              <ChoiceGroup
                legend="Reward"
                type="radio"
                name="reward"
                layout="stack"
                value={[rewardId ?? 'none']}
                onChange={([v]) => setRewardId(v === 'none' ? null : String(v))}
                choices={[
                  { value: 'none', label: 'No reward' },
                  ...loyalty.summary.rewards
                    .filter((r) => r.unlocked)
                    .map((r) => ({
                      value: r.id,
                      label: r.label,
                      disabled: !r.affordable,
                      hint: r.affordable
                        ? `${r.costPoints.toLocaleString('en-US')} pts`
                        : `needs ${r.costPoints.toLocaleString('en-US')} pts`,
                    })),
                ]}
              />
              {quote?.notices.map((n) => (
                <p key={n} role="status" className="mt-2 text-body-sm text-danger">
                  {n}
                </p>
              ))}
            </section>
          )}

          <section aria-labelledby="code-heading" className="mt-8 border-t border-line pt-6">
            <h2 id="code-heading" className="mb-3 text-headline font-semibold">
              Discount code
            </h2>
            {appliedCode && !codeNotice ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-body">
                  <span className="font-display text-headline font-semibold tracking-wide">{appliedCode}</span>
                  <span className="ml-3 text-body-sm text-muted">{quote ? (quote.codeFils > 0 ? `takes ${formatAedNumber(quote.codeFils)} AED off` : 'checking...') : 'checking...'}</span>
                </p>
                <Button variant="tertiary" size="md" onClick={() => { setAppliedCode(null); setCodeText('') }}>
                  Remove
                </Button>
              </div>
            ) : (
              <form
                className="flex max-w-md items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const next = codeText.trim().toUpperCase()
                  if (next) setAppliedCode(next)
                }}
              >
                <div className="min-w-0 flex-1">
                  <TextField label="Have a code?" value={codeText} onChange={(e) => setCodeText(e.target.value.toUpperCase())} maxLength={20} autoComplete="off" error={codeNotice ?? null} disabled={busy} />
                </div>
                <Button type="submit" variant="secondary" size="lg" disabled={busy || !codeText.trim()}>
                  Apply
                </Button>
              </form>
            )}
          </section>

          <section aria-labelledby="when-heading" className="mt-8 border-t border-line pt-6">
            <h2 id="when-heading" className="mb-2 text-headline font-semibold">
              When
            </h2>
            <ChoiceGroup
              legend="Pickup time"
              type="radio"
              name="when"
              layout="split"
              value={[when]}
              onChange={([v]) => {
                setWhen(v as 'asap' | 'later')
                if (v === 'asap') setPickupAt(null)
              }}
              choices={[
                { value: 'asap', label: 'As soon as possible' },
                { value: 'later', label: 'Pick a time' },
              ]}
            />
            {when === 'later' && (
              <div className="mt-4">
                <SlotPicker slots={slots} error={slotsError} value={pickupAt} onChange={setPickupAt} />
              </div>
            )}
            <p className="mt-3 text-body text-muted" aria-live="polite">
              {slotNotice ?? eta ?? (needsTime ? 'Pick a time to continue.' : 'Working out your wait...')}
            </p>
            {when === 'later' && method === 'cash' && (
              <p className="mt-1 text-body-sm text-muted">Pay at the counter before your pickup time. We start making it once you have.</p>
            )}
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
          <Breakdown quote={quote} total={total} />
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
