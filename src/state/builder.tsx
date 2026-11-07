import type { BuilderData } from '@shared/builder'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, errorMessage } from '../lib/api'
import { useLiveRefresh } from '../lib/liveEvents'

interface BuilderValue {
  status: 'loading' | 'ready' | 'error'
  /** What the builder offers and what it costs. Null until it has loaded. */
  data: BuilderData | null
  error: string | null
  offline: boolean
  reload: () => void
}

const BuilderContext = createContext<BuilderValue | null>(null)

export function useBuilder(): BuilderValue {
  const value = useContext(BuilderContext)
  if (!value) throw new Error('useBuilder must be used inside BuilderProvider')
  return value
}

/**
 * The builder's options and prices, kept fresh like the menu. The cart needs them to show a custom coffee's price,
 * so this sits above the cart. It is a few kilobytes.
 */
export function BuilderProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BuilderValue['status']>('loading')
  const [data, setData] = useState<BuilderData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  const load = useCallback(async (quiet: boolean) => {
    if (!quiet) setStatus('loading')
    try {
      setData(await api<BuilderData>('/builder'))
      setError(null)
      setOffline(false)
      setStatus('ready')
    } catch (e) {
      if (quiet) return
      setError(errorMessage(e))
      setOffline(e instanceof ApiError && e.isOffline)
      setStatus('error')
    }
  }, [])

  useLiveRefresh(() => void load(true))
  useEffect(() => {
    void load(false)
  }, [load])

  const value = useMemo<BuilderValue>(() => ({ status, data, error, offline, reload: () => void load(false) }), [status, data, error, offline, load])
  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>
}
