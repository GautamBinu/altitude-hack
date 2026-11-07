import type { HomeResponse, UsualResponse } from '@shared/types'
import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, errorMessage } from '../lib/api'
import { useLiveRefresh } from '../lib/liveEvents'

type State = { status: 'loading' } | { status: 'ready'; data: HomeResponse } | { status: 'error'; message: string; offline: boolean }

/** The public parts of the home screen. Refreshed every minute so "popular" and the featured drink stay current. */
export function useHome() {
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = useCallback(async (quiet: boolean) => {
    try {
      const data = await api<HomeResponse>('/home')
      setState({ status: 'ready', data })
    } catch (e) {
      if (quiet) return
      setState({ status: 'error', message: errorMessage(e), offline: e instanceof ApiError && e.isOffline })
    }
  }, [])

  useLiveRefresh(() => void load(true))

  useEffect(() => {
    void load(false)
    const id = window.setInterval(() => void load(true), 60_000)
    return () => window.clearInterval(id)
  }, [load])

  return { state, reload: () => void load(false) }
}

/** "Your usual" and the last order, for signed-in members. */
export function useUsual(userId: number | null, refreshKey: string) {
  const [usual, setUsual] = useState<UsualResponse | null>(null)
  useEffect(() => {
    if (userId == null) {
      setUsual(null)
      return
    }
    let cancelled = false
    api<UsualResponse>('/me/usual')
      .then((r) => !cancelled && setUsual(r))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])
  return usual
}
