/**
 * Queue ordering and the estimated time to ready. Pure functions, no database, so they are easy to test.
 *
 * The queue holds paid orders waiting to be made (status "queued") and orders being made
 * ("preparing"). Orders are made in the order they were confirmed: card orders at the moment of
 * payment, cash orders at the moment staff accepted payment.
 */

export interface QueueEntry {
  id: number
  status: 'queued' | 'preparing'
  /** When the order joined the queue (ms since epoch). */
  confirmedAtMs: number
  /** When a barista started it (ms since epoch). Null while still queued. */
  startedAtMs: number | null
  /** Total time to make the whole order, in seconds. */
  prepSeconds: number
}

export interface QueueInfo {
  /** Orders that will be made before this one. */
  ahead: number
  etaSeconds: number
}

export function compareQueue(a: QueueEntry, b: QueueEntry): number {
  return a.confirmedAtMs - b.confirmedAtMs || a.id - b.id
}

export function sortQueue(entries: QueueEntry[]): QueueEntry[] {
  return [...entries].sort(compareQueue)
}

/** Prep time still to go. An order already being made counts down from when it was started. */
export function remainingPrepSeconds(entry: QueueEntry, nowMs: number): number {
  if (entry.status === 'preparing' && entry.startedAtMs != null) {
    return Math.max(0, entry.prepSeconds - (nowMs - entry.startedAtMs) / 1000)
  }
  return entry.prepSeconds
}

/**
 * Estimate = (prep time of the orders ahead / number of baristas) + this order's own prep time.
 *
 * "Ahead" is every order currently being made, plus every queued order confirmed earlier. An order
 * a barista has already started has nothing ahead of it, only its own remaining time.
 */
export function queueInfoFor(
  target: QueueEntry,
  queue: QueueEntry[],
  baristas: number,
  nowMs: number,
): QueueInfo {
  const staff = Math.max(1, Math.floor(baristas) || 1)
  const ahead =
    target.status === 'preparing'
      ? []
      : queue.filter((e) => e.id !== target.id && (e.status === 'preparing' || compareQueue(e, target) < 0))
  const aheadSeconds = ahead.reduce((sum, e) => sum + remainingPrepSeconds(e, nowMs), 0)
  return {
    ahead: ahead.length,
    etaSeconds: Math.round(aheadSeconds / staff + remainingPrepSeconds(target, nowMs)),
  }
}

/** The position and wait a brand-new order would get if it joined the queue right now. */
export function quoteNewOrder(
  prepSeconds: number,
  queue: QueueEntry[],
  baristas: number,
  nowMs: number,
): QueueInfo {
  const hypothetical: QueueEntry = {
    id: Number.MAX_SAFE_INTEGER,
    status: 'queued',
    confirmedAtMs: nowMs,
    startedAtMs: null,
    prepSeconds,
  }
  return queueInfoFor(hypothetical, queue, baristas, nowMs)
}

/** An order is late when it has been in the queue longer than the shop's threshold. */
export function isLate(
  status: string,
  confirmedAtMs: number | null,
  nowMs: number,
  lateAfterSeconds: number,
): boolean {
  if (status !== 'queued' && status !== 'preparing') return false
  if (confirmedAtMs == null) return false
  return (nowMs - confirmedAtMs) / 1000 > lateAfterSeconds
}
