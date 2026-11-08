export function greetingFor(date = new Date()): string {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** "Waiting 4 min" style: whole minutes, never negative. */
export function minutesSince(iso: string | null, nowMs: number): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 60000))
}

export function clockTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function shortDateTime(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  const time = clockTime(iso)
  if (sameDay) return `Today, ${time}`
  return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`
}

/** "Tue 10 Nov, 17:00" in the viewer's clock. */
export function eventWhen(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Set the browser tab title for a page. */
export function pageTitle(title?: string): string {
  return title ? `${title} | Altitude` : 'Altitude'
}

/** 40 -> "40 s", 95 -> "1 min 35 s", 600 -> "10 min". Null when there is nothing to show. */
export function durationLabel(seconds: number | null): string {
  if (seconds == null) return 'No data'
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return `${total} s`
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return rest === 0 || minutes >= 10 ? `${minutes} min` : `${minutes} min ${rest} s`
}

/** A business date such as "2026-11-07" as "Sat 7 Nov", independent of the viewer's time zone. */
export function businessDayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** 13 -> "13:00". */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

/** 0.256 -> "26%". */
export function percentLabel(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}
