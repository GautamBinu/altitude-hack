import type { SlotDay, SlotsResponse } from '../../shared/types'
import { db } from '../db'
import { OrderError } from '../domain/pricing'
import { WEEKDAYS } from '../seed-data'
import { slotStarts } from '../domain/time'
import { addDays, businessDate, getSettings, weekdayIndex, zonedTimeToUtc, type Settings } from './settings'

/**
 * Pre-order time slots. A slot is a window of `slotMinutes` inside the shop's opening hours. Each slot
 * takes a limited number of orders (`slotCapacity`), so the bar is never asked to make more than it can
 * for one pickup time. A pickup time must also be a little way off (`minLeadMinutes`) so there is time to
 * make the drink.
 */

const clock = (date: Date, timezone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)

/** Every slot start in one day. Empty when the shop is closed that day. */
export function slotStartsForDay(dateStr: string, settings: Settings): number[] {
  const hours = settings.openingHours[WEEKDAYS[weekdayIndex(zonedTimeToUtc(dateStr, '12:00', settings.timezone), settings.timezone)]]
  return slotStarts(hours, dateStr, settings.slotMinutes, settings.timezone)
}

function takenBySlot(fromIso: string, toIso: string): Map<string, number> {
  const rows = db
    .prepare(
      `SELECT pickup_at AS at, COUNT(*) AS n FROM orders
       WHERE pickup_at >= ? AND pickup_at <= ? AND status != 'cancelled' GROUP BY pickup_at`,
    )
    .all(fromIso, toIso) as { at: string; n: number }[]
  return new Map(rows.map((r) => [new Date(r.at).toISOString(), r.n]))
}

export function listSlots(nowMs = Date.now()): SlotsResponse {
  const settings = getSettings()
  const today = businessDate(new Date(nowMs), settings.timezone)
  const earliest = nowMs + settings.minLeadMinutes * 60_000
  const days: SlotDay[] = []

  for (let d = 0; d <= settings.daysAhead; d++) {
    const date = addDays(today, d)
    const starts = slotStartsForDay(date, settings)
    const hours = settings.openingHours[WEEKDAYS[weekdayIndex(zonedTimeToUtc(date, '12:00', settings.timezone), settings.timezone)]]
    const taken = starts.length ? takenBySlot(new Date(starts[0]).toISOString(), new Date(starts[starts.length - 1]).toISOString()) : new Map<string, number>()
    const label =
      d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, weekday: 'long' }).format(zonedTimeToUtc(date, '12:00', settings.timezone))
    days.push({
      date,
      label,
      closed: hours.closed,
      hours: hours.closed ? null : `${hours.open} to ${hours.close}`,
      slots: starts
        .filter((s) => s >= earliest)
        .map((s) => {
          const iso = new Date(s).toISOString()
          const count = taken.get(iso) ?? 0
          return { startsAt: iso, label: clock(new Date(s), settings.timezone), taken: count, capacity: settings.slotCapacity, full: count >= settings.slotCapacity }
        }),
    })
  }
  return { slotMinutes: settings.slotMinutes, days }
}

export function slotCount(pickupIso: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE pickup_at = ? AND status != 'cancelled'`).get(pickupIso) as { n: number }).n
}

/**
 * Checks a pickup time a customer chose. It must be a real slot, inside opening hours, far enough away,
 * not too far ahead, and not full. Returns the slot start. The messages are written for the customer.
 */
export function validateSlot(pickupAt: string, nowMs = Date.now()): Date {
  const settings = getSettings()
  const t = Date.parse(pickupAt)
  if (!Number.isFinite(t)) throw new OrderError('That pickup time is not valid.', 'invalid_slot')
  const day = businessDate(new Date(t), settings.timezone)
  const today = businessDate(new Date(nowMs), settings.timezone)
  if (day < today || day > addDays(today, settings.daysAhead)) throw new OrderError("We can't take pre-orders for that day.", 'invalid_slot', 409)
  if (!slotStartsForDay(day, settings).includes(t)) throw new OrderError("We're not open for pickup at that time.", 'invalid_slot', 409)
  if (t < nowMs + settings.minLeadMinutes * 60_000) throw new OrderError('That time is too soon. Pick a later one, or order as soon as possible.', 'slot_too_soon', 409)
  const iso = new Date(t).toISOString()
  if (slotCount(iso) >= settings.slotCapacity) throw new OrderError('That time just filled up. Pick another.', 'slot_full', 409)
  return new Date(t)
}
