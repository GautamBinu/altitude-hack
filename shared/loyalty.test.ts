import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REWARDS,
  DEFAULT_TIERS,
  nextTierFor,
  pointsForOrder,
  progressFor,
  rewardStates,
  tierFor,
  validateLoyaltyConfig,
} from './loyalty'

describe('tiers', () => {
  it('places members on the right tier at the thresholds', () => {
    const name = (p: number) => tierFor(p, DEFAULT_TIERS).name
    expect(name(0)).toBe('Bronze')
    expect(name(499)).toBe('Bronze')
    expect(name(500)).toBe('Silver')
    expect(name(999)).toBe('Silver')
    expect(name(1000)).toBe('Gold')
    expect(name(1499)).toBe('Gold')
    expect(name(1500)).toBe('Platinum')
    expect(name(99999)).toBe('Platinum')
  })

  it('finds the next tier, and none at the top', () => {
    expect(nextTierFor(0, DEFAULT_TIERS)?.name).toBe('Silver')
    expect(nextTierFor(1240, DEFAULT_TIERS)?.name).toBe('Platinum')
    expect(nextTierFor(1500, DEFAULT_TIERS)).toBeNull()
  })

  it('is not thrown by tiers given out of order', () => {
    const shuffled = [DEFAULT_TIERS[2], DEFAULT_TIERS[0], DEFAULT_TIERS[3], DEFAULT_TIERS[1]]
    expect(tierFor(700, shuffled).name).toBe('Silver')
  })
})

describe('points for an order', () => {
  it('gives 1 point per AED at the base rate, rounded down', () => {
    expect(pointsForOrder(3100, 1)).toBe(31)
    expect(pointsForOrder(3250, 1)).toBe(32)
    expect(pointsForOrder(99, 1)).toBe(0)
  })

  it('applies the tier multiplier before rounding down', () => {
    expect(pointsForOrder(3100, 1.25)).toBe(38) // 38.75
    expect(pointsForOrder(2500, 1.1)).toBe(27) // 27.5
    expect(pointsForOrder(2000, 1.5)).toBe(30)
  })

  it('gives nothing for free or invalid orders', () => {
    expect(pointsForOrder(0, 1.5)).toBe(0)
    expect(pointsForOrder(-500, 1.5)).toBe(0)
    expect(pointsForOrder(Number.NaN, 1)).toBe(0)
  })
})

describe('progress to the next tier', () => {
  it('matches the deck example: Gold, 1,240 points, 260 to Platinum', () => {
    const p = progressFor(1240, DEFAULT_TIERS)
    expect(p.tier.name).toBe('Gold')
    expect(p.nextTier?.name).toBe('Platinum')
    expect(p.pointsToNext).toBe(260)
    expect(p.fraction).toBeCloseTo(0.48, 5)
    expect(p.climb).toBeCloseTo(2.48, 5)
  })

  it('is full at the top tier', () => {
    const p = progressFor(2000, DEFAULT_TIERS)
    expect(p.tier.name).toBe('Platinum')
    expect(p.pointsToNext).toBe(0)
    expect(p.fraction).toBe(1)
    expect(p.climb).toBe(3)
  })

  it('starts at the bottom', () => {
    const p = progressFor(0, DEFAULT_TIERS)
    expect(p.climb).toBe(0)
    expect(p.pointsToNext).toBe(500)
  })
})

describe('rewards', () => {
  it('unlocks by tier and affords by balance independently', () => {
    const states = rewardStates(300, 'Silver', DEFAULT_TIERS, DEFAULT_REWARDS)
    const byId = Object.fromEntries(states.map((s) => [s.id, s]))
    expect(byId['off-5']).toMatchObject({ unlocked: true, affordable: true })
    expect(byId['off-15']).toMatchObject({ unlocked: true, affordable: true })
    expect(byId['off-30']).toMatchObject({ unlocked: false, affordable: false })
  })

  it('a high balance does not unlock a higher tier reward', () => {
    const states = rewardStates(2000, 'Bronze', DEFAULT_TIERS, DEFAULT_REWARDS)
    const big = states.find((s) => s.id === 'off-60')!
    expect(big.affordable).toBe(true)
    expect(big.unlocked).toBe(false)
  })
})

describe('loyalty settings validation', () => {
  it('accepts the defaults', () => {
    expect(validateLoyaltyConfig(DEFAULT_TIERS, DEFAULT_REWARDS)).toBeNull()
  })
  it('rejects tiers that do not start at zero or do not climb', () => {
    expect(validateLoyaltyConfig([{ ...DEFAULT_TIERS[0], minPoints: 10 }, DEFAULT_TIERS[1]], [])).toMatch(/start at 0/)
    expect(validateLoyaltyConfig([DEFAULT_TIERS[0], { ...DEFAULT_TIERS[1], minPoints: 0 }], [])).toMatch(/more points/)
  })
  it('rejects a reward pointing at a missing tier', () => {
    expect(validateLoyaltyConfig(DEFAULT_TIERS, [{ ...DEFAULT_REWARDS[0], minTier: 'Diamond' }])).toMatch(/does not exist/)
  })
})
