/*
 * Typing a pickup time. The checkout lets a customer type "14:30", "1430", "2:30 pm" or "2pm", or step with arrows.
 * Everything here is plain functions so the rules can be tested without a screen.
 */

export interface ClockInput {
  /** Minutes since midnight, 0 to 1439. */
  minutes: number
  /** True when the customer wrote am or pm, so we know not to guess. */
  meridiem: boolean
}

/** "14:30", "1430", "930", "2:30 pm", "2pm", "14.30" and "14" all work. Anything else is null. */
export function parseClockTime(input: string): ClockInput | null {
  const text = input.trim().toLowerCase()
  const match = /^(\d{1,2})(?:[:.h]?(\d{2}))?\s*(a|p|am|pm)?$/.exec(text)
  if (!match) return null
  let hours = Number(match[1])
  const minutes = match[2] === undefined ? 0 : Number(match[2])
  const suffix = match[3]
  if (minutes > 59) return null
  if (suffix) {
    if (hours < 1 || hours > 12) return null
    hours = (hours % 12) + (suffix.startsWith('p') ? 12 : 0)
  } else if (hours > 23) {
    return null
  }
  return { minutes: hours * 60 + minutes, meridiem: Boolean(suffix) }
}

/** "13:30" to 810. */
export function labelToMinutes(label: string): number {
  const [hours, minutes] = label.split(':').map(Number)
  return hours * 60 + minutes
}

/** 810 to "13:30". */
export function clockLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export interface PickableSlot {
  /** "13:30" in the shop's clock. */
  label: string
  full: boolean
}

export type TypedPick =
  | { kind: 'exact'; index: number }
  /** The time typed is full or is not on the grid, so the next free slot after it was chosen. */
  | { kind: 'moved'; index: number; because: 'full' | 'not-a-slot' }
  | { kind: 'before' }
  | { kind: 'after' }
  | { kind: 'none' }

/**
 * Turn a typed time into a slot. A time between two slots rounds up to the next free one, because pickup is
 * "at or after". Times outside the day's slots are not guessed at.
 */
export function resolveTyped(slots: readonly PickableSlot[], minutes: number): TypedPick {
  if (slots.length === 0) return { kind: 'none' }
  const times = slots.map((s) => labelToMinutes(s.label))
  if (minutes < times[0]) return { kind: 'before' }
  if (minutes > times[times.length - 1]) return { kind: 'after' }
  const exact = times.indexOf(minutes)
  if (exact >= 0 && !slots[exact].full) return { kind: 'exact', index: exact }
  for (let i = 0; i < slots.length; i++) {
    if (times[i] >= minutes && !slots[i].full) return { kind: 'moved', index: i, because: exact >= 0 ? 'full' : 'not-a-slot' }
  }
  return { kind: 'none' }
}

/** The next free slot before (-1) or after (1) `from`. With nothing chosen yet, later means the first free slot. */
export function stepSlot(slots: readonly PickableSlot[], from: number | null, direction: 1 | -1): number | null {
  if (from === null) {
    if (direction === -1) return null
    const first = slots.findIndex((s) => !s.full)
    return first >= 0 ? first : null
  }
  for (let i = from + direction; i >= 0 && i < slots.length; i += direction) {
    if (!slots[i].full) return i
  }
  return null
}