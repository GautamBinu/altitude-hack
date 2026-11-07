/**
 * Queue ordering and the estimated time to ready. Pure functions, no database, so they are easy to test.
 *
 * The queue holds paid orders waiting to be made (status "queued") and orders being made
 * ("preparing"). Each order has a queue key, `queueAtMs`:
 *
 *   - an "as soon as possible" order: the moment it was confirmed (card: paid; cash: payment accepted)
 *   - a pre-order: the moment it is due to start, which is its pickup time minus its prep time
 *
 * Orders are made in key order, so a pre-order slots in at the right place when its time arrives,
 * behind everything confirmed before that moment and ahead of everything confirmed after it.
 */

export interface QueueEntry {
  id: number
  status: 'queued' | 'preparing'
  /** The order's place in the queue (ms since epoch). */
  queueAtMs: number
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
  return a.queueAtMs - b.queueAtMs || a.id - b.id
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
 * "Ahead" is every order currently being made, plus every queued order with an earlier queue key. An
 * order a barista has already started has nothing ahead of it, only its own remaining time.
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

/** The position and wait a brand-new "as soon as possible" order would get if it joined the queue right now. */
export function quoteNewOrder(
  prepSeconds: number,
  queue: QueueEntry[],
  baristas: number,
  nowMs: number,
): QueueInfo {
  const hypothetical: QueueEntry = {
    id: Number.MAX_SAFE_INTEGER,
    status: 'queued',
    queueAtMs: nowMs,
    startedAtMs: null,
    prepSeconds,
  }
  return queueInfoFor(hypothetical, queue, baristas, nowMs)
}

/* ---------- Pre-orders ---------- */

export interface ScheduledEntry {
  id: number
  pickupAtMs: number
  /** pickup time minus prep time: when the order enters the queue. */
  dueAtMs: number
  prepSeconds: number
}

export interface ScheduledForecast {
  /** Orders that will be made before this one starts. */
  ahead: number
  /** When it would be ready if things carry on as they are. */
  readyAtMs: number
  /** How far past the pickup time that is. Zero when it will be ready on time. */
  lateBySeconds: number
}

/**
 * Works out when a pre-order would really be ready.
 *
 * Each barista is free at some time: right now, or when the order they are making finishes. The
 * queue goes first, in order. Then pre-orders due earlier than this one, each starting no sooner
 * than its own due time. Finally this order, starting no sooner than its due time.
 *
 * With plenty of capacity it is ready exactly at pickup. If the queue is long it slips past
 * pickup, and the customer is told so.
 */
export function forecastScheduled(
  target: ScheduledEntry,
  queue: QueueEntry[],
  scheduled: ScheduledEntry[],
  baristas: number,
  nowMs: number,
): ScheduledForecast {
  const staff = Math.max(1, Math.floor(baristas) || 1)
  const free: number[] = Array.from({ length: staff }, () => nowMs)

  const run = (earliestStartMs: number, seconds: number): number => {
    free.sort((a, b) => a - b)
    const start = Math.max(free[0], earliestStartMs)
    const end = start + seconds * 1000
    free[0] = end
    return end
  }

  // Orders being made hold a barista until they finish. Queued orders start as soon as someone is free.
  const sortedQueue = sortQueue(queue)
  for (const entry of sortedQueue) run(nowMs, remainingPrepSeconds(entry, nowMs))

  const earlier = scheduled
    .filter((s) => s.id !== target.id && (s.dueAtMs < target.dueAtMs || (s.dueAtMs === target.dueAtMs && s.id < target.id)))
    .sort((a, b) => a.dueAtMs - b.dueAtMs || a.id - b.id)
  for (const entry of earlier) run(entry.dueAtMs, entry.prepSeconds)

  const readyAtMs = run(target.dueAtMs, target.prepSeconds)
  return {
    ahead: sortedQueue.length + earlier.length,
    readyAtMs,
    lateBySeconds: Math.max(0, Math.round((readyAtMs - target.pickupAtMs) / 1000)),
  }
}

/**
 * An "as soon as possible" order is late when it has been in the queue longer than the shop's
 * threshold. A pre-order is late when it is still not ready a short grace after its pickup time.
 */
export function isLate(
  status: string,
  queueAtMs: number | null,
  nowMs: number,
  lateAfterSeconds: number,
  pickupAtMs?: number | null,
  graceSeconds = 120,
): boolean {
  if (status !== 'queued' && status !== 'preparing') return false
  if (pickupAtMs != null) return nowMs - pickupAtMs > graceSeconds * 1000
  if (queueAtMs == null) return false
  return (nowMs - queueAtMs) / 1000 > lateAfterSeconds
}
