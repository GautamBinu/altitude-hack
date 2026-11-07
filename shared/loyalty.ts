/**
 * Loyalty maths: tiers, points earned per order, progress to the next tier, and which rewards a
 * member can use. Pure functions shared by the server (which awards and checks) and the web app
 * (which shows progress).
 *
 * Tier is decided by LIFETIME points earned, so spending points on a reward never drops a member
 * down a tier. Redeemable BALANCE is lifetime points minus what has been spent.
 */

export interface TierDef {
  name: string
  /** Lifetime points needed to reach this tier. */
  minPoints: number
  /** Points earned per AED spent, as a multiplier on the base rate of 1 point per AED. */
  multiplier: number
  perks: string[]
}

export interface RewardDef {
  id: string
  label: string
  costPoints: number
  /** Discount taken off the order, in fils. */
  discountFils: number
  /** The lowest tier that can use this reward. */
  minTier: string
}

/** Thresholds follow SPEC.md section 4 (Bronze 0, Silver 500, Gold 1,000, Platinum 1,500) and are configurable. */
export const DEFAULT_TIERS: TierDef[] = [
  { name: 'Bronze', minPoints: 0, multiplier: 1, perks: ['1 point for every AED you spend.', 'Rewards from 100 points.'] },
  { name: 'Silver', minPoints: 500, multiplier: 1.1, perks: ['10% bonus points on every order.', 'Unlocks the AED 15 reward.'] },
  { name: 'Gold', minPoints: 1000, multiplier: 1.25, perks: ['25% bonus points on every order.', 'Unlocks the AED 30 reward.'] },
  { name: 'Platinum', minPoints: 1500, multiplier: 1.5, perks: ['50% bonus points on every order.', 'Unlocks the AED 60 reward.'] },
]

export const DEFAULT_REWARDS: RewardDef[] = [
  { id: 'off-5', label: 'AED 5 off your order', costPoints: 100, discountFils: 500, minTier: 'Bronze' },
  { id: 'off-15', label: 'AED 15 off your order', costPoints: 250, discountFils: 1500, minTier: 'Silver' },
  { id: 'off-30', label: 'AED 30 off your order', costPoints: 450, discountFils: 3000, minTier: 'Gold' },
  { id: 'off-60', label: 'AED 60 off your order', costPoints: 800, discountFils: 6000, minTier: 'Platinum' },
]

/** Tiers sorted from lowest to highest. */
export function sortTiers(tiers: TierDef[]): TierDef[] {
  return [...tiers].sort((a, b) => a.minPoints - b.minPoints)
}

export function tierIndexFor(lifetimePoints: number, tiers: TierDef[]): number {
  const sorted = sortTiers(tiers)
  let index = 0
  sorted.forEach((tier, i) => {
    if (lifetimePoints >= tier.minPoints) index = i
  })
  return index
}

export function tierFor(lifetimePoints: number, tiers: TierDef[]): TierDef {
  return sortTiers(tiers)[tierIndexFor(lifetimePoints, tiers)]
}

export function nextTierFor(lifetimePoints: number, tiers: TierDef[]): TierDef | null {
  const sorted = sortTiers(tiers)
  return sorted[tierIndexFor(lifetimePoints, tiers) + 1] ?? null
}

/** Points earned for one order: 1 per AED actually paid, times the tier multiplier, rounded down. */
export function pointsForOrder(paidFils: number, multiplier: number): number {
  if (!Number.isFinite(paidFils) || paidFils <= 0) return 0
  return Math.floor((paidFils * multiplier) / 100 + 1e-9)
}

export interface TierProgress {
  tier: TierDef
  nextTier: TierDef | null
  pointsToNext: number
  /** 0 to 1 within the current tier's band. 1 at the top tier. */
  fraction: number
  /** Position along the climb: tier index plus the fraction within that tier. 0 to tiers.length - 1. */
  climb: number
}

export function progressFor(lifetimePoints: number, tiers: TierDef[]): TierProgress {
  const sorted = sortTiers(tiers)
  const index = tierIndexFor(lifetimePoints, tiers)
  const tier = sorted[index]
  const next = sorted[index + 1] ?? null
  if (!next) return { tier, nextTier: null, pointsToNext: 0, fraction: 1, climb: index }
  const span = next.minPoints - tier.minPoints
  const fraction = span > 0 ? Math.min(1, Math.max(0, (lifetimePoints - tier.minPoints) / span)) : 1
  return { tier, nextTier: next, pointsToNext: Math.max(0, next.minPoints - lifetimePoints), fraction, climb: index + fraction }
}

export interface RewardState extends RewardDef {
  /** The member's tier is high enough. */
  unlocked: boolean
  /** The member has enough points right now. */
  affordable: boolean
}

export function rewardStates(balance: number, tierName: string, tiers: TierDef[], rewards: RewardDef[]): RewardState[] {
  const sorted = sortTiers(tiers)
  const rank = (name: string) => Math.max(0, sorted.findIndex((t) => t.name === name))
  const mine = rank(tierName)
  return rewards.map((reward) => ({
    ...reward,
    unlocked: mine >= rank(reward.minTier),
    affordable: balance >= reward.costPoints,
  }))
}

/** Checks the loyalty settings an admin typed in before they are saved. Returns an error message or null. */
export function validateLoyaltyConfig(tiers: TierDef[], rewards: RewardDef[]): string | null {
  if (tiers.length < 2) return 'Add at least two tiers.'
  const sorted = sortTiers(tiers)
  if (sorted[0].minPoints !== 0) return 'The lowest tier must start at 0 points.'
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minPoints <= sorted[i - 1].minPoints) return 'Each tier needs more points than the one before.'
  }
  if (tiers.some((t) => !(t.multiplier >= 1 && t.multiplier <= 5))) return 'Point multipliers must be between 1 and 5.'
  if (new Set(tiers.map((t) => t.name.trim().toLowerCase())).size !== tiers.length) return 'Tier names must be different.'
  for (const reward of rewards) {
    if (!sorted.some((t) => t.name === reward.minTier)) return `Reward "${reward.label}" points to a tier that does not exist.`
    if (!(reward.costPoints > 0) || !(reward.discountFils > 0)) return `Reward "${reward.label}" needs a points cost and a discount.`
  }
  return null
}
