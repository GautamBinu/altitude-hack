import type {
  HomeBanner,
  HomeDrinkOfMonth,
  HomeEvent,
  HomeResponse,
  PopularEntry,
  PopularWindow,
  UsualResponse,
} from '../../shared/types'
import { db } from '../db'
import { businessDate, getSettings, zonedTimeToUtc } from './settings'

/** Orders that count toward "popular": everything except cancelled orders. Items that no longer exist are skipped by the app. */
function popularSince(sinceIso: string, limit: number): PopularEntry[] {
  const rows = db
    .prepare(
      `SELECT oi.item_id AS itemId, SUM(oi.quantity) AS count
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelled' AND o.created_at >= ? AND oi.item_id IS NOT NULL
       GROUP BY oi.item_id ORDER BY count DESC, oi.item_id LIMIT ?`,
    )
    .all(sinceIso, limit) as PopularEntry[]
  return rows
}

function popularWindows(): { today: PopularWindow; week: PopularWindow } {
  const settings = getSettings()
  const now = new Date()
  const midnight = zonedTimeToUtc(businessDate(now, settings.timezone), '00:00', settings.timezone).toISOString()
  const dayAgo = new Date(now.getTime() - 24 * 3_600_000).toISOString()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3_600_000).toISOString()

  // Early in the shop's day, "today" has barely begun. Fall back to the last 24 hours and say so.
  let today: PopularWindow = { label: 'Today', items: popularSince(midnight, 8) }
  if (today.items.length < 3) today = { label: 'Last 24 hours', items: popularSince(dayAgo, 8) }
  return { today, week: { label: '7 days', items: popularSince(weekAgo, 8) } }
}

function drinkOfMonth(): HomeDrinkOfMonth | null {
  const row = db.prepare('SELECT item_id, headline, copy, image, ends_at, active FROM promo_drink WHERE id = 1').get() as
    | { item_id: number | null; headline: string; copy: string; image: string | null; ends_at: string | null; active: number }
    | undefined
  if (!row || !row.active) return null
  if (row.ends_at && Date.parse(row.ends_at) < Date.now()) return null
  if (row.item_id != null) {
    const item = db.prepare('SELECT hidden, sold_out FROM items WHERE id = ?').get(row.item_id) as { hidden: number; sold_out: number } | undefined
    if (!item || item.hidden) return null
  }
  return { itemId: row.item_id, headline: row.headline, copy: row.copy, imageUrl: row.image, endsAt: row.ends_at }
}

function banners(): HomeBanner[] {
  const nowIso = new Date().toISOString()
  const rows = db
    .prepare(
      `SELECT id, title, body, image, item_id FROM promos
       WHERE active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?)
       ORDER BY sort_order, id LIMIT 2`,
    )
    .all(nowIso, nowIso) as { id: number; title: string; body: string; image: string | null; item_id: number | null }[]
  return rows.map((r) => ({ id: r.id, title: r.title, body: r.body, imageUrl: r.image, itemId: r.item_id }))
}

/** The next few approved events, soonest first. Posts without a date come after, newest first. */
export function upcomingEvents(limit = 3): HomeEvent[] {
  const nowIso = new Date().toISOString()
  const rows = db
    .prepare(
      `SELECT id, kind, title, club, starts_at, place, is_sample FROM posts
       WHERE status = 'approved' AND (starts_at IS NULL OR starts_at >= ?)
       ORDER BY (starts_at IS NULL), starts_at, id DESC LIMIT ?`,
    )
    .all(nowIso, limit) as { id: number; kind: 'event' | 'post'; title: string; club: string; starts_at: string | null; place: string | null; is_sample: number }[]
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    club: r.club,
    startsAt: r.starts_at,
    place: r.place,
    isSample: r.is_sample === 1,
  }))
}

export function getHome(): HomeResponse {
  return { drinkOfMonth: drinkOfMonth(), banners: banners(), popular: popularWindows(), events: upcomingEvents(3) }
}

/** The member's most repeated order line, and their last order, for one-tap reordering. */
export function getUsual(userId: number): UsualResponse {
  const top = db
    .prepare(
      `SELECT oi.item_id AS itemId, oi.selections AS selections, oi.note AS note, SUM(oi.quantity) AS n
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = ? AND o.status != 'cancelled' AND oi.item_id IS NOT NULL AND oi.selections IS NOT NULL
       GROUP BY oi.item_id, oi.selections, COALESCE(oi.note, '')
       ORDER BY n DESC, MAX(o.id) DESC LIMIT 1`,
    )
    .get(userId) as { itemId: number; selections: string; note: string | null; n: number } | undefined

  const lastOrder = db
    .prepare(`SELECT id, number FROM orders WHERE user_id = ? AND status != 'cancelled' ORDER BY id DESC LIMIT 1`)
    .get(userId) as { id: number; number: number } | undefined

  let last: UsualResponse['last'] = null
  if (lastOrder) {
    const lines = db
      .prepare(
        `SELECT item_id, quantity, selections, note FROM order_items
         WHERE order_id = ? AND item_id IS NOT NULL AND selections IS NOT NULL ORDER BY id`,
      )
      .all(lastOrder.id) as { item_id: number; quantity: number; selections: string; note: string | null }[]
    if (lines.length > 0) {
      last = {
        orderId: lastOrder.id,
        number: lastOrder.number,
        lines: lines.map((l) => ({
          itemId: l.item_id,
          quantity: l.quantity,
          selections: JSON.parse(l.selections) as Record<string, number[]>,
          note: l.note,
        })),
      }
    }
  }

  return {
    usual:
      top && top.n >= 2
        ? { itemId: top.itemId, selections: JSON.parse(top.selections) as Record<string, number[]>, note: top.note, count: top.n }
        : null,
    last,
  }
}

