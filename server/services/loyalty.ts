import type { LedgerEntry, LoyaltySummary, RewardView, TierView } from '../../shared/types'
import { pointsForOrder, progressFor, rewardStates, tierFor, type RewardDef } from '../../shared/loyalty'
import { db } from '../db'
import { OrderError } from '../domain/pricing'
import { getSettings } from './settings'

/**
 * Points ledger. Every change to a member's points is a row, so history, balance and tier can always
 * be explained.
 *
 *   earn    points for a collected order
 *   redeem  points spent on a reward at checkout
 *   refund  points given back when an order that used a reward is cancelled
 *   adjust  a manual change by staff
 *
 * Tier follows LIFETIME points (earn + adjust). Balance is everything, including what was spent.
 */

const now = () => new Date().toISOString()

export function balances(userId: number): { balance: number; lifetime: number } {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(delta), 0) AS balance,
              COALESCE(SUM(CASE WHEN kind IN ('earn', 'adjust') THEN delta ELSE 0 END), 0) AS lifetime
       FROM loyalty_ledger WHERE user_id = ?`,
    )
    .get(userId) as { balance: number; lifetime: number }
  return { balance: row.balance, lifetime: Math.max(0, row.lifetime) }
}

const toTierView = (t: { name: string; minPoints: number; multiplier: number; perks: string[] }): TierView => ({
  name: t.name,
  minPoints: t.minPoints,
  multiplier: t.multiplier,
  perks: t.perks,
})

export function history(userId: number, limit = 40): LedgerEntry[] {
  const rows = db
    .prepare('SELECT id, delta, kind, reason, order_id, created_at FROM loyalty_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(userId, limit) as { id: number; delta: number; kind: LedgerEntry['kind']; reason: string; order_id: number | null; created_at: string }[]
  return rows.map((r) => ({ id: r.id, delta: r.delta, kind: r.kind, reason: r.reason, orderId: r.order_id, createdAt: r.created_at }))
}

export function summaryFor(userId: number, historyLimit = 40): LoyaltySummary {
  const settings = getSettings()
  const { balance, lifetime } = balances(userId)
  const progress = progressFor(lifetime, settings.tiers)
  const rewards: RewardView[] = rewardStates(balance, progress.tier.name, settings.tiers, settings.rewards).map((r) => ({
    id: r.id,
    label: r.label,
    costPoints: r.costPoints,
    discountFils: r.discountFils,
    minTier: r.minTier,
    unlocked: r.unlocked,
    affordable: r.affordable,
  }))
  return {
    balance,
    lifetime,
    tier: toTierView(progress.tier),
    nextTier: progress.nextTier ? toTierView(progress.nextTier) : null,
    pointsToNext: progress.pointsToNext,
    fraction: progress.fraction,
    climb: progress.climb,
    tiers: settings.tiers.map(toTierView),
    rewards,
    history: history(userId, historyLimit),
  }
}

/** Finds a reward the member may use right now, or explains why not. */
export function resolveReward(userId: number, rewardId: string): RewardDef {
  const settings = getSettings()
  const reward = settings.rewards.find((r) => r.id === rewardId)
  if (!reward) throw new OrderError("That reward isn't available.", 'reward_unavailable', 409)
  const { balance, lifetime } = balances(userId)
  const state = rewardStates(balance, tierFor(lifetime, settings.tiers).name, settings.tiers, [reward])[0]
  if (!state.unlocked) throw new OrderError(`That reward unlocks at ${reward.minTier}.`, 'reward_locked', 409)
  if (!state.affordable) throw new OrderError("You don't have enough points for that reward yet.", 'reward_unaffordable', 409)
  return reward
}

function insert(userId: number, delta: number, kind: LedgerEntry['kind'], reason: string, orderId: number | null, at = now()): void {
  db.prepare('INSERT INTO loyalty_ledger (user_id, delta, kind, reason, order_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    userId,
    delta,
    kind,
    reason,
    orderId,
    at,
  )
}

export function recordRedeem(userId: number, points: number, orderId: number, label: string): void {
  insert(userId, -points, 'redeem', label, orderId)
}

export function recordRefund(userId: number, points: number, orderId: number, number: number): void {
  if (points > 0) insert(userId, points, 'refund', `Order #${number} was cancelled`, orderId)
}

/** Points for a collected order, at the member's tier on the day. Called once, when the order is marked collected. */
export function awardForOrder(orderId: number, userId: number, number: number, paidFils: number): number {
  const settings = getSettings()
  const { lifetime } = balances(userId)
  const tier = tierFor(lifetime, settings.tiers)
  const points = pointsForOrder(paidFils, tier.multiplier)
  if (points > 0) {
    insert(userId, points, 'earn', `Order #${number}`, orderId)
    db.prepare('UPDATE orders SET points_awarded = ? WHERE id = ?').run(points, orderId)
  }
  return points
}

/** A manual change by staff, with a reason that shows in the member's history. */
export function adjustPoints(userId: number, delta: number, reason: string): void {
  if (!Number.isInteger(delta) || delta === 0) throw new OrderError('Enter a whole number of points.', 'invalid_request')
  const { balance } = balances(userId)
  if (balance + delta < 0) throw new OrderError("That would take the member's balance below zero.", 'invalid_request')
  insert(userId, delta, 'adjust', reason.trim().slice(0, 120) || 'Adjustment by staff', null)
}

/** For seeding history: write an entry with a given timestamp. */
export function insertLedgerAt(userId: number, delta: number, kind: LedgerEntry['kind'], reason: string, orderId: number | null, at: string): void {
  insert(userId, delta, kind, reason, orderId, at)
}
