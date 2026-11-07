import { describe, expect, it } from 'vitest'
import { addDays, businessDate, slotStarts, weekdayIndex, zonedTimeToUtc } from './time'

const DUBAI = 'Asia/Dubai'

describe('shop timezone', () => {
  it('reads Dubai local time as UTC+4', () => {
    expect(zonedTimeToUtc('2026-11-07', '09:30', DUBAI).toISOString()).toBe('2026-11-07T05:30:00.000Z')
    expect(zonedTimeToUtc('2026-11-07', '00:00', DUBAI).toISOString()).toBe('2026-11-06T20:00:00.000Z')
  })

  it('puts an evening UTC time on the next calendar day in Dubai', () => {
    expect(businessDate(new Date('2026-11-07T21:00:00Z'), DUBAI)).toBe('2026-11-08')
    expect(businessDate(new Date('2026-11-07T19:59:00Z'), DUBAI)).toBe('2026-11-07')
  })

  it('finds the weekday in the shop timezone, Monday first', () => {
    expect(weekdayIndex(new Date('2026-11-09T06:00:00Z'), DUBAI)).toBe(0) // Monday
    expect(weekdayIndex(new Date('2026-11-08T06:00:00Z'), DUBAI)).toBe(6) // Sunday
  })

  it('is correct in a zone with daylight saving too', () => {
    // New York: UTC-5 in winter, UTC-4 in summer.
    expect(zonedTimeToUtc('2026-01-15', '12:00', 'America/New_York').toISOString()).toBe('2026-01-15T17:00:00.000Z')
    expect(zonedTimeToUtc('2026-07-15', '12:00', 'America/New_York').toISOString()).toBe('2026-07-15T16:00:00.000Z')
  })

  it('adds days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('slot grid', () => {
  const hours = { open: '08:00', close: '10:00', closed: false }

  it('lists slots from opening to closing', () => {
    const starts = slotStarts(hours, '2026-11-07', 30, DUBAI)
    expect(starts).toHaveLength(4)
    expect(new Date(starts[0]).toISOString()).toBe('2026-11-07T04:00:00.000Z')
    expect(new Date(starts[3]).toISOString()).toBe('2026-11-07T05:30:00.000Z')
  })

  it('never includes a slot that would run past closing', () => {
    // 45 minute slots: 08:00, 08:45, 09:30 fits (ends 10:15? no). Only slots that finish by 10:00 count.
    const starts = slotStarts(hours, '2026-11-07', 45, DUBAI)
    expect(starts.map((s) => new Date(s).toISOString().slice(11, 16))).toEqual(['04:00', '04:45'])
  })

  it('is empty on a closed day', () => {
    expect(slotStarts({ ...hours, closed: true }, '2026-11-07', 10, DUBAI)).toEqual([])
  })
})
