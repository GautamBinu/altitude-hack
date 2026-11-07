import { describe, expect, it } from 'vitest'
import { applyDiscounts, codeDiscountFils } from './discounts'

describe('order totals', () => {
  it('is just the subtotal with no discounts', () => {
    expect(applyDiscounts({ subtotalFils: 5300 })).toEqual({ subtotalFils: 5300, passFils: 0, codeFils: 0, rewardFils: 0, totalFils: 5300 })
  })

  it('takes a percentage code off first, rounding the discount down', () => {
    expect(codeDiscountFils(3333, { kind: 'percent', value: 10 })).toBe(333)
    expect(applyDiscounts({ subtotalFils: 5000, code: { kind: 'percent', value: 20 } }).totalFils).toBe(4000)
  })

  it('applies the reward after the code, on what is left', () => {
    const r = applyDiscounts({ subtotalFils: 5000, code: { kind: 'percent', value: 20 }, rewardFils: 500 })
    expect(r).toMatchObject({ codeFils: 1000, rewardFils: 500, totalFils: 3500 })
  })

  it('takes Summit Box value off before any code', () => {
    const r = applyDiscounts({ subtotalFils: 6000, passFils: 2500, code: { kind: 'percent', value: 10 } })
    expect(r).toMatchObject({ passFils: 2500, codeFils: 350, totalFils: 3150 })
  })

  it('never goes below zero', () => {
    expect(applyDiscounts({ subtotalFils: 1000, rewardFils: 5000 }).totalFils).toBe(0)
    expect(applyDiscounts({ subtotalFils: 1000, code: { kind: 'fixed', value: 99999 } }).totalFils).toBe(0)
    expect(applyDiscounts({ subtotalFils: 1000, passFils: 5000 }).passFils).toBe(1000)
  })

  it('ignores negative or absurd inputs', () => {
    expect(codeDiscountFils(1000, { kind: 'percent', value: 500 })).toBe(1000)
    expect(codeDiscountFils(1000, { kind: 'percent', value: -5 })).toBe(0)
    expect(applyDiscounts({ subtotalFils: -50 }).totalFils).toBe(0)
  })
})
