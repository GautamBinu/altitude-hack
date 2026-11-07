import type { LedgerEntry } from '@shared/types'
import { Link } from 'react-router'
import { LoyaltyCard, TierBadge } from '../../components/loyalty/LoyaltyCard'
import { SignInOptions } from '../../components/SignInOptions'
import { LoadingLine } from '../../components/ui/Art'
import { LinkButton } from '../../components/ui/Button'
import { Price } from '../../components/ui/Price'
import { shortDateTime } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useLoyalty } from '../../state/loyalty'
import { useSession } from '../../state/session'
import { cx } from '../../lib/cx'

const KIND_LABEL: Record<LedgerEntry['kind'], string> = {
  earn: 'Earned',
  redeem: 'Spent',
  refund: 'Returned',
  adjust: 'Adjusted',
}

/** The tier page: where you are on the climb, what each tier gives, rewards you can use, and every point you have earned or spent. */
export function LoyaltyPage() {
  useDocumentTitle('Rewards')
  const { user } = useSession()
  const { summary, loaded } = useLoyalty()

  if (!user) {
    return (
      <div className="max-w-md">
        <h1 className="text-display-lg font-bold">Rewards</h1>
        <p className="mt-2 mb-6 text-body text-muted">Sign in to earn a point for every dirham and climb from Bronze to Platinum.</p>
        <SignInOptions />
      </div>
    )
  }
  if (!loaded || !summary) {
    return (
      <div role="status" className="max-w-md">
        <LoadingLine label="Loading your rewards" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-display-lg font-bold">Rewards</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start lg:gap-12">
        <div className="grid gap-10">
          <LoyaltyCard summary={summary} linked={false} />

          <section aria-labelledby="tiers-heading">
            <h2 id="tiers-heading" className="mb-4 text-headline font-semibold">
              What each tier gives
            </h2>
            <ol className="divide-y divide-line border-y border-line">
              {summary.tiers.map((tier) => {
                const current = tier.name === summary.tier.name
                return (
                  <li key={tier.name} className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]">
                    <div className="flex items-center gap-3 sm:block">
                      <p className="font-display text-headline font-semibold leading-none">{tier.name}</p>
                      <p className="text-body-sm text-muted tnum">from {tier.minPoints.toLocaleString('en-US')} pts</p>
                    </div>
                    <div>
                      <ul className="grid gap-0.5 text-body text-ink">
                        {tier.perks.map((perk) => (
                          <li key={perk}>{perk}</li>
                        ))}
                      </ul>
                      {current && <p className="mt-2 text-body-sm font-semibold text-accent">Your tier</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>

        <div className="grid gap-10">
          <section aria-labelledby="rewards-heading">
            <h2 id="rewards-heading" className="mb-1 text-headline font-semibold">
              Rewards
            </h2>
            <p className="mb-4 text-body-sm text-muted">Pick one at checkout. Points are spent when you place the order.</p>
            <ul className="grid gap-2">
              {summary.rewards.map((reward) => {
                const usable = reward.unlocked && reward.affordable
                return (
                  <li
                    key={reward.id}
                    className={cx('flex items-center justify-between gap-4 rounded-md border px-4 py-3', usable ? 'border-control' : 'border-line opacity-75')}
                  >
                    <div className="min-w-0">
                      <p className="text-title font-semibold leading-snug">{reward.label}</p>
                      <p className="text-body-sm text-muted tnum">
                        {!reward.unlocked
                          ? `Unlocks at ${reward.minTier}`
                          : !reward.affordable
                            ? `${(reward.costPoints - summary.balance).toLocaleString('en-US')} more points`
                            : 'Ready to use'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-price font-semibold leading-none tnum">{reward.costPoints.toLocaleString('en-US')}</p>
                      <p className="text-label font-semibold uppercase text-muted">pts</p>
                    </div>
                  </li>
                )
              })}
            </ul>
            <LinkButton to="/menu" size="lg" block className="mt-4">
              Order and use a reward
            </LinkButton>
          </section>
        </div>
      </div>

      <section aria-labelledby="history-heading" className="mt-12">
        <h2 id="history-heading" className="mb-4 text-headline font-semibold">
          Points history
        </h2>
        {summary.history.length === 0 ? (
          <p className="text-body text-muted">Nothing yet. Points land here when you collect an order.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {summary.history.map((entry) => (
              <li key={entry.id} className="flex min-h-14 items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-ink">
                    {entry.orderId ? (
                      <Link to={`/orders/${entry.orderId}`} className="underline-offset-4 hover:underline">
                        {entry.reason}
                      </Link>
                    ) : (
                      entry.reason
                    )}
                  </p>
                  <p className="text-body-sm text-muted">
                    {KIND_LABEL[entry.kind]} · {shortDateTime(entry.createdAt)}
                  </p>
                </div>
                <p className={cx('shrink-0 font-display text-price font-semibold tnum', entry.delta < 0 ? 'text-muted' : 'text-ink')}>
                  {entry.delta > 0 ? '+' : '-'}
                  {Math.abs(entry.delta).toLocaleString('en-US')}
                  <span className="ml-1 text-label font-semibold uppercase text-muted">pts</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-body-sm text-muted">
        <TierBadge name={summary.tier.name} className="mr-2" />
        Points are earned when your order is marked collected, at one point for every <Price fils={100} size="sm" className="align-baseline" /> you pay, plus your tier bonus.
      </p>
    </div>
  )
}
