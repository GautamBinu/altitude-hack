import type { SlotsResponse } from '@shared/types'
import { useEffect, useState } from 'react'
import { api, errorMessage } from '../lib/api'

/** Pre-order slots, loaded when the customer asks to pick a time and refreshed while they choose. */
export function useSlots(enabled: boolean) {
  const [slots, setSlots] = useState<SlotsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const load = () =>
      api<SlotsResponse>('/slots')
        .then((s) => {
          if (cancelled) return
          setSlots(s)
          setError(null)
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(errorMessage(e))
        })
    void load()
    // Places fill up while someone is deciding, so keep the list current.
    const id = window.setInterval(() => void load(), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [enabled])

  return { slots, error }
}
