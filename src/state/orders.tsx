import type { OrderView, OrdersStreamPayload } from '@shared/types'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { syncServerClock } from '../lib/clock'
import { useEventSource } from '../lib/useEventSource'
import { useSession } from './session'

interface OrdersValue {
  orders: OrderView[]
  /** Orders that are not collected yet. */
  active: OrderView[]
  loaded: boolean
  /** True while the live connection is up. When it is down we poll instead. */
  live: boolean
  /** Server time of the last update we received. */
  lastUpdateAt: string | null
  refresh: () => Promise<void>
  /** Show a just-placed order straight away, before the stream catches up. */
  upsert: (order: OrderView) => void
}

const OrdersContext = createContext<OrdersValue | null>(null)

export function useOrders(): OrdersValue {
  const value = useContext(OrdersContext)
  if (!value) throw new Error('useOrders must be used inside OrdersProvider')
  return value
}

const POLL_MS = 8000

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const userId = user?.id ?? null
  const [orders, setOrders] = useState<OrderView[]>([])
  const [loaded, setLoaded] = useState(false)
  const [lastUpdateAt, setLastUpdateAt] = useState<string | null>(null)

  const apply = useCallback((payload: OrdersStreamPayload) => {
    syncServerClock(payload.serverNow)
    setOrders(payload.orders)
    setLastUpdateAt(payload.serverNow)
    setLoaded(true)
  }, [])

  const refresh = useCallback(async () => {
    if (userId == null) return
    try {
      apply(await api<OrdersStreamPayload>('/orders/mine'))
    } catch {
      /* the live stream or the next poll will catch up */
    }
  }, [userId, apply])

  const live = useEventSource(userId == null ? null : '/api/stream/orders', { orders: (p) => apply(p as OrdersStreamPayload) })

  // Signing in or out resets everything.
  useEffect(() => {
    setOrders([])
    setLoaded(false)
    setLastUpdateAt(null)
    if (userId != null) void refresh()
  }, [userId, refresh])

  // If the live connection drops, keep the tracker honest by polling until it returns.
  useEffect(() => {
    if (userId == null || live) return
    const id = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(id)
  }, [userId, live, refresh])

  const upsert = useCallback((order: OrderView) => {
    setOrders((list) => [order, ...list.filter((o) => o.id !== order.id)])
    setLoaded(true)
  }, [])

  const value = useMemo<OrdersValue>(
    () => ({
      orders,
      active: orders.filter((o) => o.status !== 'collected' && o.status !== 'cancelled'),
      loaded,
      live,
      lastUpdateAt,
      refresh,
      upsert,
    }),
    [orders, loaded, live, lastUpdateAt, refresh, upsert],
  )

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}
