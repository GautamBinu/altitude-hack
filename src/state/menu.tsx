import type { MenuCategory, MenuItem, MenuResponse } from '@shared/types'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, errorMessage } from '../lib/api'
import { useLiveRefresh } from '../lib/liveEvents'

type Status = 'loading' | 'ready' | 'error'

interface MenuValue {
  status: Status
  error: string | null
  offline: boolean
  categories: MenuCategory[]
  itemsById: Map<number, MenuItem>
  reload: () => void
}

const MenuContext = createContext<MenuValue | null>(null)

export function useMenu(): MenuValue {
  const value = useContext(MenuContext)
  if (!value) throw new Error('useMenu must be used inside MenuProvider')
  return value
}

const REFRESH_MS = 60_000

/** Loads the menu once and keeps it fresh, so a price or sold-out change in the shop reaches open apps. */
export function MenuProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [categories, setCategories] = useState<MenuCategory[]>([])

  const load = useCallback(async (quiet: boolean) => {
    if (!quiet) setStatus('loading')
    try {
      const res = await api<MenuResponse>('/menu')
      setCategories(res.categories)
      setError(null)
      setOffline(false)
      setStatus('ready')
    } catch (e) {
      // A failed background refresh keeps the menu we already have.
      if (quiet) return
      setError(errorMessage(e))
      setOffline(e instanceof ApiError && e.isOffline)
      setStatus('error')
    }
  }, [])

  useLiveRefresh(() => void load(true))

  useEffect(() => {
    void load(false)
    const id = window.setInterval(() => void load(true), REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const itemsById = useMemo(() => {
    const map = new Map<number, MenuItem>()
    for (const category of categories) for (const item of category.items) map.set(item.id, item)
    return map
  }, [categories])

  const value = useMemo<MenuValue>(
    () => ({ status, error, offline, categories, itemsById, reload: () => void load(false) }),
    [status, error, offline, categories, itemsById, load],
  )

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>
}
