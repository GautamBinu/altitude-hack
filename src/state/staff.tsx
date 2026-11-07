import type { StaffUser } from '@shared/types'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'

interface StaffValue {
  status: 'loading' | 'ready'
  user: StaffUser | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** The server said our session is over (for example after 12 hours). */
  expire: () => void
}

const StaffContext = createContext<StaffValue | null>(null)

export function useStaff(): StaffValue {
  const value = useContext(StaffContext)
  if (!value) throw new Error('useStaff must be used inside StaffProvider')
  return value
}

export function StaffProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [user, setUser] = useState<StaffUser | null>(null)

  useEffect(() => {
    let cancelled = false
    api<{ user: StaffUser | null }>('/dashboard/me')
      .then((r) => !cancelled && setUser(r.user))
      .catch(() => {
        /* offline: show the login screen, which explains itself on submit */
      })
      .finally(() => !cancelled && setStatus('ready'))
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api<{ user: StaffUser }>('/dashboard/login', { body: { username, password } })
    setUser(res.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/dashboard/logout', { method: 'POST', body: {} })
    } finally {
      setUser(null)
    }
  }, [])

  const expire = useCallback(() => setUser(null), [])

  const value = useMemo(() => ({ status, user, login, logout, expire }), [status, user, login, logout, expire])
  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>
}
