/**
 * Calendar and clock helpers for the shop's timezone. Pure, so they can be tested without a database.
 * The shop is in Dubai (UTC+4, no daylight saving), but nothing here assumes that.
 */

/** The calendar day (YYYY-MM-DD) an instant falls on in the shop's timezone. Order numbers restart each day. */
export function businessDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** 0 = Monday ... 6 = Sunday, in the shop's timezone. */
export function weekdayIndex(date: Date, timezone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(date)
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name)
}

/**
 * The instant at which the clock in `timezone` reads `dateStr` (YYYY-MM-DD) at `hhmm`.
 * Works for zones with or without daylight saving: it asks Intl what offset applies at that moment.
 */
export function zonedTimeToUtc(dateStr: string, hhmm: string, timezone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = hhmm.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(guess))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asLocal = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return new Date(guess - (asLocal - guess))
}

/** Add whole days to a YYYY-MM-DD string. */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

export interface DayHours {
  open: string
  close: string
  closed: boolean
}

/**
 * Every slot start in one day, as milliseconds, from opening time to closing time. A slot must fit
 * entirely before closing. Empty when the shop is closed that day.
 */
export function slotStarts(hours: DayHours, dateStr: string, slotMinutes: number, timezone: string): number[] {
  if (hours.closed) return []
  const open = zonedTimeToUtc(dateStr, hours.open, timezone).getTime()
  const close = zonedTimeToUtc(dateStr, hours.close, timezone).getTime()
  const step = slotMinutes * 60_000
  const starts: number[] = []
  for (let t = open; t + step <= close; t += step) starts.push(t)
  return starts
}
