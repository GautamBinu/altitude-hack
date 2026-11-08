import { describe, expect, it } from 'vitest'
import { clockLabel, labelToMinutes, parseClockTime, resolveTyped, stepSlot, type PickableSlot } from './clock'

const at = (label: string, full = false): PickableSlot => ({ label, full })
// 13:00 to 13:40 in ten minute steps, with 13:20 full.
const slots = [at('13:00'), at('13:10'), at('13:20', true), at('13:30'), at('13:40')]

describe('parseClockTime', () => {
  it('reads the ways people type a time', () => {
    expect(parseClockTime('14:30')).toEqual({ minutes: 870, meridiem: false })
    expect(parseClockTime('1430')?.minutes).toBe(870)
    expect(parseClockTime('930')?.minutes).toBe(570)
    expect(parseClockTime('9')?.minutes).toBe(540)
    expect(parseClockTime('14.30')?.minutes).toBe(870)
    expect(parseClockTime(' 07:05 ')?.minutes).toBe(425)
  })

  it('understands am and pm', () => {
    expect(parseClockTime('2:30 pm')).toEqual({ minutes: 870, meridiem: true })
    expect(parseClockTime('2PM')?.minutes).toBe(840)
    expect(parseClockTime('12am')?.minutes).toBe(0)
    expect(parseClockTime('12pm')?.minutes).toBe(720)
    expect(parseClockTime('11:59p')?.minutes).toBe(1439)
  })

  it('rejects what is not a time', () => {
    for (const bad of ['', 'abc', '25:00', '9:75', '13pm', '0pm', '14:3', '1:2:3', '-5']) expect(parseClockTime(bad), bad).toBeNull()
  })
})

describe('labels', () => {
  it('converts both ways', () => {
    expect(labelToMinutes('13:30')).toBe(810)
    expect(clockLabel(810)).toBe('13:30')
    expect(clockLabel(425)).toBe('07:05')
  })
})

describe('resolveTyped', () => {
  it('takes an exact free slot', () => {
    expect(resolveTyped(slots, labelToMinutes('13:10'))).toEqual({ kind: 'exact', index: 1 })
  })

  it('moves a full slot to the next free one', () => {
    expect(resolveTyped(slots, labelToMinutes('13:20'))).toEqual({ kind: 'moved', index: 3, because: 'full' })
  })

  it('rounds a time between slots up, never down', () => {
    expect(resolveTyped(slots, labelToMinutes('13:05'))).toEqual({ kind: 'moved', index: 1, because: 'not-a-slot' })
    expect(resolveTyped(slots, labelToMinutes('13:11'))).toEqual({ kind: 'moved', index: 3, because: 'not-a-slot' })
  })

  it('does not guess outside the day', () => {
    expect(resolveTyped(slots, labelToMinutes('12:00'))).toEqual({ kind: 'before' })
    expect(resolveTyped(slots, labelToMinutes('14:00'))).toEqual({ kind: 'after' })
  })

  it('says so when nothing free is left at or after the time', () => {
    const lateFull = [at('13:00'), at('13:10', true), at('13:20', true)]
    expect(resolveTyped(lateFull, labelToMinutes('13:10'))).toEqual({ kind: 'none' })
    expect(resolveTyped([], 800)).toEqual({ kind: 'none' })
  })
})

describe('stepSlot', () => {
  it('skips full slots in both directions', () => {
    expect(stepSlot(slots, 1, 1)).toBe(3)
    expect(stepSlot(slots, 3, -1)).toBe(1)
  })

  it('stops at the ends', () => {
    expect(stepSlot(slots, 4, 1)).toBeNull()
    expect(stepSlot(slots, 0, -1)).toBeNull()
  })

  it('starts at the first free slot when nothing is chosen', () => {
    expect(stepSlot(slots, null, 1)).toBe(0)
    expect(stepSlot(slots, null, -1)).toBeNull()
    expect(stepSlot([at('13:00', true)], null, 1)).toBeNull()
  })
})