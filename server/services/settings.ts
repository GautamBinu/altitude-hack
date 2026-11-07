import { db } from '../db'
import { DEFAULT_SETTINGS, WEEKDAYS } from '../seed-data'
import { DEFAULT_REWARDS, DEFAULT_TIERS, type RewardDef, type TierDef } from '../../shared/loyalty'

export type Weekday = (typeof WEEKDAYS)[number]
export interface DayHours {
  open: string
  close: string
  closed: boolean
}
export type WeekHours = Record<Weekday, DayHours>

export interface SummitBoxPrice {
  size: number
  priceFils: number
}

export interface Settings {
  baristas: number
  lateAfterSeconds: number
  preorderGraceSeconds: number
  timezone: string
  typicalDrinkPrepSeconds: number
  openingHours: WeekHours
  slotMinutes: number
  slotCapacity: number
  minLeadMinutes: number
  daysAhead: number
  newOrderSound: 'chime' | 'bell' | 'off'
  summitBox: SummitBoxPrice[]
  tiers: TierDef[]
  rewards: RewardDef[]
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function readRaw(): Record<string, unknown> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const stored: Record<string, unknown> = {}
  for (const row of rows) {
    try {
      stored[row.key] = JSON.parse(row.value)
    } catch {
      /* ignore a malformed value and fall back to the default */
    }
  }
  return stored
}

function hoursFrom(value: unknown): WeekHours {
  const defaults = DEFAULT_SETTINGS.openingHours as WeekHours
  const out = {} as WeekHours
  for (const day of WEEKDAYS) {
    const raw = (value as Record<string, Partial<DayHours>> | undefined)?.[day]
    out[day] = {
      open: typeof raw?.open === 'string' && HHMM.test(raw.open) ? raw.open : defaults[day].open,
      close: typeof raw?.close === 'string' && HHMM.test(raw.close) ? raw.close : defaults[day].close,
      closed: typeof raw?.closed === 'boolean' ? raw.closed : defaults[day].closed,
    }
  }
  return out
}

/** Settings live in the database so the team can change them without a developer. */
export function getSettings(): Settings {
  const stored = readRaw()
  const num = (key: string, fallback: number, min: number, max = Infinity): number => {
    const value = Number(stored[key])
    return Number.isFinite(value) && value >= min && value <= max ? value : fallback
  }
  const loyalty = (stored.loyalty ?? {}) as { tiers?: TierDef[]; rewards?: RewardDef[] }
  const summit = Array.isArray(stored.summitBox) ? (stored.summitBox as SummitBoxPrice[]) : DEFAULT_SETTINGS.summitBox
  const sound = stored.newOrderSound
  return {
    baristas: Math.floor(num('baristas', DEFAULT_SETTINGS.baristas, 1, 20)),
    lateAfterSeconds: num('lateAfterSeconds', DEFAULT_SETTINGS.lateAfterSeconds, 60),
    preorderGraceSeconds: num('preorderGraceSeconds', DEFAULT_SETTINGS.preorderGraceSeconds, 0),
    timezone: typeof stored.timezone === 'string' ? stored.timezone : DEFAULT_SETTINGS.timezone,
    typicalDrinkPrepSeconds: num('typicalDrinkPrepSeconds', DEFAULT_SETTINGS.typicalDrinkPrepSeconds, 10),
    openingHours: hoursFrom(stored.openingHours),
    slotMinutes: Math.floor(num('slotMinutes', DEFAULT_SETTINGS.slotMinutes, 5, 60)),
    slotCapacity: Math.floor(num('slotCapacity', DEFAULT_SETTINGS.slotCapacity, 1, 50)),
    minLeadMinutes: Math.floor(num('minLeadMinutes', DEFAULT_SETTINGS.minLeadMinutes, 0, 240)),
    daysAhead: Math.floor(num('daysAhead', DEFAULT_SETTINGS.daysAhead, 0, 6)),
    newOrderSound: sound === 'bell' || sound === 'off' ? sound : 'chime',
    summitBox: summit.filter((s) => Number.isInteger(s.size) && s.size > 0 && Number.isInteger(s.priceFils) && s.priceFils >= 0),
    tiers: Array.isArray(loyalty.tiers) && loyalty.tiers.length >= 2 ? loyalty.tiers : DEFAULT_TIERS,
    rewards: Array.isArray(loyalty.rewards) ? loyalty.rewards : DEFAULT_REWARDS,
  }
}

/** Write settings. Pass the same shapes getSettings returns; only the keys given are changed. */
export function saveSettings(patch: Partial<Settings>): void {
  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
  )
  const { tiers, rewards, ...rest } = patch
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) upsert.run(key, JSON.stringify(value))
  }
  if (tiers || rewards) {
    const current = getSettings()
    upsert.run('loyalty', JSON.stringify({ tiers: tiers ?? current.tiers, rewards: rewards ?? current.rewards }))
  }
}

export { addDays, businessDate, weekdayIndex, zonedTimeToUtc } from '../domain/time'
