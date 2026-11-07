import type { QueueStatus } from '@shared/types'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

/** How busy the counter is right now. Refreshed every 20 seconds while the tab is open. */
export function useQueueStatus(): QueueStatus | null {
  const [status, setStatus] = useState<QueueStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      api<QueueStatus>('/queue-status')
        .then((s) => {
          if (!cancelled) setStatus(s)
        })
        .catch(() => {
          /* keep showing the last figure */
        })
    }
    load()
    const id = window.setInterval(load, 20_000)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return status
}

/** "About 6 minutes for a drink right now. Three orders ahead." */
export function waitSentence(status: QueueStatus): string {
  const minutes = Math.max(1, Math.round(status.estimateSeconds / 60))
  const time = minutes <= 1 ? 'About a minute' : `About ${minutes} minutes`
  if (status.inQueue === 0) return `No wait right now. ${time} for a drink.`
  const orders = status.inQueue === 1 ? '1 order' : `${status.inQueue} orders`
  return `${time} for a drink right now. ${orders} in the queue.`
}
