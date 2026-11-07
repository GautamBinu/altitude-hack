import type { Board, StaffOrderView } from '@shared/types'
import { Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CancelOrderSheet } from '../../components/dashboard/CancelOrderSheet'
import { OrderCard, type OrderPath } from '../../components/dashboard/OrderCard'
import { LoadingLine } from '../../components/ui/Art'
import { StatusChip } from '../../components/ui/Chip'
import { ErrorState } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import { api, ApiError, errorMessage } from '../../lib/api'
import { playChime, useSoundPreference } from '../../lib/chime'
import { syncServerClock, useNow } from '../../lib/clock'
import { cx } from '../../lib/cx'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useEventSource } from '../../lib/useEventSource'
import { useStaff } from '../../state/staff'

type LaneKey = 'awaiting' | 'scheduled' | 'queue' | 'ready' | 'completed'

const LANES: { key: LaneKey; title: string; short: string; empty: string }[] = [
  { key: 'awaiting', title: 'Awaiting payment', short: 'Payment', empty: 'No one is waiting to pay.' },
  { key: 'scheduled', title: 'Scheduled', short: 'Scheduled', empty: 'No pre-orders coming up.' },
  { key: 'queue', title: 'Live queue', short: 'Queue', empty: 'The queue is clear.' },
  { key: 'ready', title: 'Ready for pickup', short: 'Ready', empty: 'Nothing waiting at the counter.' },
  { key: 'completed', title: 'Completed today', short: 'Done', empty: 'Nothing collected yet today.' },
]

/** On laptops and wider the lanes sit in three columns: what needs money or a start, what is being made, what is waiting to be collected. */
const COLUMNS: LaneKey[][] = [['awaiting', 'scheduled'], ['queue'], ['ready', 'completed']]

const FRESH_MS = 60_000
const DONE_VISIBLE = 10

function useBoard() {
  const { expire } = useStaff()
  const sound = useSoundPreference()
  const soundOn = useRef(sound.enabled)
  soundOn.current = sound.enabled

  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<{ message: string; offline: boolean } | null>(null)
  const [fresh, setFresh] = useState<Map<number, number>>(new Map())

  const apply = useCallback((next: Board) => {
    syncServerClock(next.serverNow)
    setBoard(next)
    setError(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      apply(await api<Board>('/dashboard/board'))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) expire()
      else setError({ message: errorMessage(e), offline: e instanceof ApiError && e.isOffline })
    }
  }, [apply, expire])

  const live = useEventSource('/api/dashboard/stream', {
    board: (b) => apply(b as Board),
    'new-order': (o) => {
      const { id } = o as { id: number }
      setFresh((map) => new Map(map).set(id, Date.now() + FRESH_MS))
      if (soundOn.current) playChime()
    },
  })

  useEffect(() => {
    void refresh()
  }, [refresh])

  // If the live connection drops, keep the board honest by polling until it returns.
  useEffect(() => {
    if (live) return
    const id = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(id)
  }, [live, refresh])

  // Forget "New" labels once they are a minute old.
  useEffect(() => {
    if (fresh.size === 0) return
    const id = window.setInterval(() => {
      const now = Date.now()
      setFresh((map) => {
        const next = new Map([...map].filter(([, until]) => until > now))
        return next.size === map.size ? map : next
      })
    }, 5000)
    return () => window.clearInterval(id)
  }, [fresh.size])

  return { board, error, live, refresh, fresh, sound }
}

/** Kitchen display: bigger type, the screen's chrome hidden, and the finished-orders lane out of the way. */
function useKitchenMode() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    document.documentElement.dataset.kitchen = on ? 'on' : 'off'
    return () => {
      document.documentElement.dataset.kitchen = 'off'
    }
  }, [on])
  return { on, toggle: () => setOn((v) => !v) }
}

export function QueuePage() {
  useDocumentTitle('Orders')
  const toast = useToast()
  const { expire } = useStaff()
  const { board, error, live, refresh, fresh, sound } = useBoard()
  const kitchen = useKitchenMode()
  const now = useNow(15_000)
  const [chosenTab, setTab] = useState<LaneKey>('queue')
  const [pending, setPending] = useState<Set<number>>(new Set())
  const [cancelling, setCancelling] = useState<StaffOrderView | null>(null)
  const [showAllDone, setShowAllDone] = useState(false)

  const run = async (order: StaffOrderView, path: OrderPath) => {
    if (pending.has(order.id)) return
    setPending((set) => new Set(set).add(order.id))
    try {
      await api(`/dashboard/orders/${order.id}/${path}`, { method: 'POST', body: {} })
      if (!live) await refresh()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) expire()
      else {
        toast.show(errorMessage(e), 'error')
        void refresh()
      }
    } finally {
      setPending((set) => {
        const next = new Set(set)
        next.delete(order.id)
        return next
      })
    }
  }

  if (!board) {
    return error ? (
      <ErrorState title="The board didn't load" message={error.message} offline={error.offline} onRetry={() => void refresh()} className="max-w-xl" />
    ) : (
      <div role="status" className="max-w-md pt-4">
        <LoadingLine label="Loading orders" />
      </div>
    )
  }

  const firstQueued = board.queue.find((o) => o.status === 'queued')?.id
  const visibleLanes = kitchen.on ? LANES.filter((l) => l.key !== 'completed') : LANES
  const tab: LaneKey = visibleLanes.some((l) => l.key === chosenTab) ? chosenTab : 'queue'

  const renderLane = (lane: (typeof LANES)[number]): ReactNode => {
    const all = board[lane.key]
    const isCompleted = lane.key === 'completed'
    // A busy day finishes a hundred orders. Keep the latest few in view and tuck the rest behind a button.
    const capped = isCompleted && !showAllDone && all.length > DONE_VISIBLE
    const orders = capped ? all.slice(0, DONE_VISIBLE) : all
    return (
      <section
        key={lane.key}
        id={`lane-${lane.key}`}
        role="tabpanel"
        aria-labelledby={`tab-${lane.key}`}
        className={cx(tab === lane.key ? 'block' : 'hidden', 'lg:block')}
      >
        <h2 className="mb-3 hidden items-baseline justify-between text-headline font-semibold lg:flex">
          {lane.title}
          <span className="text-title text-muted tnum">{all.length}</span>
        </h2>
        {orders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-control px-4 py-8 text-center text-body text-muted">{lane.empty}</p>
        ) : (
          <ol className={cx('grid gap-3', isCompleted && 'lg:grid-cols-1')}>
            {orders.map((order) => (
              <li key={order.id}>
                <OrderCard
                  order={order}
                  nowMs={now}
                  lateAfterSeconds={board.lateAfterSeconds}
                  isNew={(fresh.get(order.id) ?? 0) > Date.now()}
                  isNext={order.id === firstQueued}
                  pending={pending.has(order.id)}
                  onAction={run}
                  onCancel={setCancelling}
                />
              </li>
            ))}
          </ol>
        )}
        {isCompleted && all.length > DONE_VISIBLE && (
          <button
            type="button"
            onClick={() => setShowAllDone((v) => !v)}
            aria-expanded={showAllDone}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-control px-3 text-body-sm font-semibold text-ink transition-colors hover:bg-raised"
          >
            {showAllDone ? 'Show fewer' : `Show all ${all.length}`}
          </button>
        )}
      </section>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-4">
          <h1 className="text-display-lg font-bold">Orders</h1>
          <p className="text-body text-muted tnum" aria-live="polite">
            {board.queue.length} in queue · {board.awaiting.length} awaiting payment · {board.scheduled.length} scheduled
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={live ? 'success' : 'warning'}>{live ? 'Live' : 'Reconnecting'}</StatusChip>
          <StatusChip tone={board.pos.connected ? 'neutral' : 'warning'}>{board.pos.label}</StatusChip>
          <button
            type="button"
            onClick={sound.toggle}
            aria-pressed={sound.enabled}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-control px-3 text-body-sm font-semibold text-ink transition-colors hover:bg-raised"
          >
            {sound.enabled ? <Volume2 size={18} strokeWidth={1.75} aria-hidden="true" /> : <VolumeX size={18} strokeWidth={1.75} aria-hidden="true" />}
            {sound.enabled ? 'Sound on' : 'Sound off'}
          </button>
          <button
            type="button"
            onClick={kitchen.toggle}
            aria-pressed={kitchen.on}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-control px-3 text-body-sm font-semibold text-ink transition-colors hover:bg-raised"
          >
            {kitchen.on ? <Minimize2 size={18} strokeWidth={1.75} aria-hidden="true" /> : <Maximize2 size={18} strokeWidth={1.75} aria-hidden="true" />}
            {kitchen.on ? 'Exit kitchen display' : 'Kitchen display'}
          </button>
        </div>
      </div>

      {!live && (
        <p role="status" className="mt-4 rounded-md border border-line bg-surface px-4 py-3 text-body-sm text-muted">
          Lost the live connection. Checking for new orders every few seconds until it comes back.
        </p>
      )}

      {/* Phone and portrait tablet: one lane at a time. */}
      <div role="tablist" aria-label="Order lanes" className="mt-5 grid gap-1 rounded-lg border border-line bg-surface p-1 lg:hidden" style={{ gridTemplateColumns: `repeat(${visibleLanes.length}, minmax(max-content, 1fr))` }}>
        {visibleLanes.map((lane) => {
          const count = board[lane.key].length
          const on = tab === lane.key
          return (
            <button
              key={lane.key}
              id={`tab-${lane.key}`}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls={`lane-${lane.key}`}
              onClick={() => setTab(lane.key)}
              className={cx(
                'flex min-h-14 flex-col items-center justify-center rounded-md px-1 text-center text-body-sm font-semibold leading-tight transition-colors',
                on ? 'bg-raised text-ink shadow-[inset_0_-2px_0_var(--c-accent)]' : 'text-muted hover:text-ink',
              )}
            >
              <span className="tnum text-title">{count}</span>
              <span>{lane.short}</span>
            </button>
          )
        })}
      </div>

      {/* Each lane is rendered once. Below laptop width the column wrappers disappear (display: contents)
          and only the chosen lane shows; from laptop width up they become three columns side by side. */}
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)]">
        {COLUMNS.map((column, i) => (
          <div key={i} className="contents lg:grid lg:content-start lg:gap-8">
            {column
              .map((key) => visibleLanes.find((l) => l.key === key))
              .filter((l): l is (typeof LANES)[number] => !!l)
              .map(renderLane)}
          </div>
        ))}
      </div>

      {cancelling && (
        <CancelOrderSheet
          key={cancelling.id}
          order={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null)
            toast.show(`Order #${cancelling.number} is cancelled.`)
            void refresh()
          }}
        />
      )}
    </div>
  )
}
