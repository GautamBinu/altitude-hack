import { db } from '../db'
import { DEFAULT_SETTINGS } from '../seed-data'

export interface Settings {
  baristas: number
  lateAfterSeconds: number
  timezone: string
  typicalDrinkPrepSeconds: number
}

/** Settings live in the database so the team can change them without a developer. */
export function getSettings(): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const stored: Record<string, unknown> = {}
  for (const row of rows) {
    try {
      stored[row.key] = JSON.parse(row.value)
    } catch {
      /* ignore a malformed value and fall back to the default */
    }
  }
  const num = (key: keyof Settings, fallback: number, min: number): number => {
    const value = Number(stored[key])
    return Number.isFinite(value) && value >= min ? value : fallback
  }
  return {
    baristas: Math.floor(num('baristas', DEFAULT_SETTINGS.baristas, 1)),
    lateAfterSeconds: num('lateAfterSeconds', DEFAULT_SETTINGS.lateAfterSeconds, 60),
    timezone: typeof stored.timezone === 'string' ? stored.timezone : DEFAULT_SETTINGS.timezone,
    typicalDrinkPrepSeconds: num('typicalDrinkPrepSeconds', DEFAULT_SETTINGS.typicalDrinkPrepSeconds, 10),
  }
}

/** The calendar day an order belongs to in the shop's timezone. Order numbers restart each day. */
export function businessDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
