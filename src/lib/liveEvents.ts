import { useEffect, useRef } from 'react'

/**
 * One shared connection that tells every open screen "the menu or promotions changed". Screens that
 * show menu data register a callback and fetch again when it fires. The connection opens when the
 * first screen asks for it and closes when the last one leaves.
 */
const listeners = new Set<() => void>()
let source: EventSource | null = null
let retry: number | undefined

function connect() {
  if (source || typeof EventSource === 'undefined') return
  source = new EventSource('/api/stream/public')
  source.addEventListener('menu', () => listeners.forEach((fn) => fn()))
  source.onerror = () => {
    if (source && source.readyState === EventSource.CLOSED) {
      source.close()
      source = null
      if (listeners.size > 0) retry = window.setTimeout(connect, 5000)
    }
  }
}

function disconnect() {
  window.clearTimeout(retry)
  source?.close()
  source = null
}

/** Run `refresh` whenever the shop changes the menu, a price, a promotion or a post. */
export function useLiveRefresh(refresh: () => void): void {
  const ref = useRef(refresh)
  ref.current = refresh
  useEffect(() => {
    const fn = () => ref.current()
    listeners.add(fn)
    connect()
    return () => {
      listeners.delete(fn)
      if (listeners.size === 0) disconnect()
    }
  }, [])
}
