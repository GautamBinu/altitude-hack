import { useEffect, useState } from 'react'

/**
 * Phones and tablets rarely agree on the time. Every snapshot from the server carries the server's
 * clock, and we keep the difference so countdowns and "waiting 4 min" labels use server time.
 */
let offsetMs = 0

export function syncServerClock(serverNowIso: string): void {
  const server = Date.parse(serverNowIso)
  if (Number.isFinite(server)) offsetMs = server - Date.now()
}

export function serverNow(): number {
  return Date.now() + offsetMs
}

/** Server time in ms, re-rendering every `intervalMs`. */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    setNow(serverNow())
    const id = window.setInterval(() => setNow(serverNow()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
