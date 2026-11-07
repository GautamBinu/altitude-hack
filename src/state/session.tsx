import type { AppConfig, AuthUser } from '@shared/types'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, errorMessage } from '../lib/api'

type Status = 'loading' | 'ready' | 'error'

interface SessionValue {
  status: Status
  error: string | null
  offline: boolean
  config: AppConfig | null
  user: AuthUser | null
  reload: () => void
  signInWithGoogle: (credential: string) => Promise<void>
  signInDemo: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    Promise.all([api<AppConfig>('/config'), api<{ user: AuthUser | null }>('/auth/me')])
      .then(([cfg, me]) => {
        if (cancelled) return
        setConfig(cfg)
        setUser(me.user)
        setError(null)
        setOffline(false)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(errorMessage(e))
        setOffline(e instanceof ApiError && e.isOffline)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const signInWithGoogle = useCallback(async (credential: string) => {
    const res = await api<{ user: AuthUser }>('/auth/google', { body: { credential } })
    setUser(res.user)
  }, [])

  const signInDemo = useCallback(async () => {
    const res = await api<{ user: AuthUser }>('/auth/demo', { method: 'POST', body: {} })
    setUser(res.user)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} })
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo<SessionValue>(
    () => ({
      status,
      error,
      offline,
      config,
      user,
      reload: () => setAttempt((n) => n + 1),
      signInWithGoogle,
      signInDemo,
      signOut,
    }),
    [status, error, offline, config, user, signInWithGoogle, signInDemo, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
