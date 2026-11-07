import type { LoyaltySummary } from '@shared/types'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { useOrders } from './orders'
import { useSession } from './session'

interface LoyaltyValue {
  summary: LoyaltySummary | null
  loaded: boolean
  refresh: () => Promise<void>
}

const LoyaltyContext = createContext<LoyaltyValue | null>(null)

export function useLoyalty(): LoyaltyValue {
  const value = useContext(LoyaltyContext)
  if (!value) throw new Error('useLoyalty must be used inside LoyaltyProvider')
  return value
}

/** The member's points and tier. Refreshes whenever one of their orders changes, so collecting an order shows up at once. */
export function LoyaltyProvider({ children }: { children: ReactNode }) {
  const { user } = useSession()
  const { orders } = useOrders()
  const userId = user?.id ?? null
  const [summary, setSummary] = useState<LoyaltySummary | null>(null)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (userId == null) return
    try {
      setSummary(await api<LoyaltySummary>('/me/loyalty'))
    } catch {
      /* keep the last figures */
    } finally {
      setLoaded(true)
    }
  }, [userId])

  // Points move when an order is placed (a reward is spent), collected (points are earned) or cancelled.
  const ordersKey = orders.map((o) => `${o.id}:${o.status}:${o.pointsAwarded}`).join('|')
  useEffect(() => {
    if (userId == null) {
      setSummary(null)
      setLoaded(false)
      return
    }
    void refresh()
  }, [userId, ordersKey, refresh])

  const value = useMemo(() => ({ summary, loaded, refresh }), [summary, loaded, refresh])
  return <LoyaltyContext.Provider value={value}>{children}</LoyaltyContext.Provider>
}
