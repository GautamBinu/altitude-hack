import type { LoyaltySummary } from '@shared/types'
import { Link } from 'react-router'
import { cx } from '../../lib/cx'
import { ClimbProgress } from './ClimbProgress'

/** The tier badge: a plain rounded chip on navy with the tier named in words. */
export function TierBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cx('inline-block rounded-sm bg-navy px-2 py-1 text-label font-semibold uppercase text-cream', className)}>
      {name}
    </span>
  )
}

/** Points, tier and progress to the next tier, with one line that says what is left to climb. */
export function LoyaltyCard({ summary, linked = true }: { summary: LoyaltySummary; linked?: boolean }) {
  const next = summary.nextTier
  const line = next
    ? `${summary.pointsToNext.toLocaleString('en-US')} pts to ${next.name}`
    : "You're at the summit. Keep earning for rewards."

  const header = (
    <div className="flex items-end justify-between gap-4">
      <div>
        <TierBadge name={summary.tier.name} />
        <p className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-display-lg font-bold leading-none tnum">{summary.balance.toLocaleString('en-US')}</span>
          <span className="text-label font-semibold uppercase text-muted">pts</span>
        </p>
      </div>
      <p className="max-w-40 pb-1 text-right text-body-sm text-muted">{line}</p>
    </div>
  )

  return (
    <section aria-label="Your points" className="rounded-lg border border-line bg-surface p-5 md:p-6">
      {linked ? (
        <Link to="/loyalty" className="block rounded-md focus-visible:outline-offset-4" aria-label={`${summary.tier.name} tier, ${summary.balance} points. ${line}. See rewards.`}>
          {header}
        </Link>
      ) : (
        header
      )}
      <div className="mt-5">
        <ClimbProgress summary={summary} />
      </div>
    </section>
  )
}
