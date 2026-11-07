import { useEffect, useRef, useState } from 'react'

type Handlers = Record<string, (data: unknown) => void>

/**
 * Subscribe to a Server-Sent Events stream. Returns whether the stream is currently connected.
 *
 * The browser reconnects by itself after a dropped connection. If the server refuses the stream
 * outright (for example after the session expired) the browser gives up, so we retry on a timer.
 */
export function useEventSource(url: string | null, handlers: Handlers): boolean {
  const [connected, setConnected] = useState(false)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!url) {
      setConnected(false)
      return
    }
    let source: EventSource | null = null
    let retry: number | undefined
    let stopped = false

    const open = () => {
      if (stopped) return
      source = new EventSource(url, { withCredentials: true })
      source.onopen = () => setConnected(true)
      source.onerror = () => {
        setConnected(false)
        if (source && source.readyState === EventSource.CLOSED) {
          source.close()
          retry = window.setTimeout(open, 5000)
        }
      }
      for (const name of Object.keys(handlersRef.current)) {
        source.addEventListener(name, (event) => {
          try {
            handlersRef.current[name]?.(JSON.parse((event as MessageEvent<string>).data))
          } catch {
            /* ignore a malformed message */
          }
        })
      }
    }
    open()

    return () => {
      stopped = true
      window.clearTimeout(retry)
      source?.close()
      setConnected(false)
    }
    // Handler names are fixed per call site; only the URL decides when to reconnect.
  }, [url])

  return connected
}
