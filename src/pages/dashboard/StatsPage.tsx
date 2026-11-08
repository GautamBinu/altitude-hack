import { Download } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { formatAedNumber } from '@shared/money'
import type { StatsRange, StatsResponse } from '@shared/stats'
import { Tabs } from '../../components/dashboard/forms'
import { BarList, ChartFrame, Delta, Kpi, Section, Split, Unit } from '../../components/stats/blocks'
import { HoursChart, QueueChart, SalesChart, type HourPoint, type QueuePoint, type SalesPoint } from '../../components/stats/charts'
import { LoadingLine } from '../../components/ui/Art'
import { buttonClass } from '../../components/ui/Button'
import { ErrorState } from '../../components/ui/States'
import { api, ApiError, errorMessage } from '../../lib/api'
import { businessDayLabel, clockTime, durationLabel, hourLabel, percentLabel, pluralise } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const RANGES: { key: StatsRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
]

const aed = (fils: number) => `AED ${formatAedNumber(fils)}`

function salesPoints(stats: StatsResponse): SalesPoint[] {
  if (stats.range === 'today') {
    return stats.hours.map((h) => ({ label: hourLabel(h.hour), full: `${hourLabel(h.hour)} to ${hourLabel(h.hour + 1)}`, revenueFils: h.revenueFils, orders: h.orders }))
  }
  const tick = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', stats.range === '7d' ? { weekday: 'short', day: 'numeric', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return stats.days.map((d) => ({ label: tick(d.date), full: businessDayLabel(d.date), revenueFils: d.revenueFils, orders: d.orders }))
}

export function StatsPage() {
  useDocumentTitle('Statistics')
  const [params, setParams] = useSearchParams()
  const requested = params.get('range')
  const range: StatsRange = requested === '7d' || requested === '30d' ? requested : 'today'

  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<{ message: string; offline: boolean } | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const next = await api<StatsResponse>(`/dashboard/stats?range=${range}`, { signal })
        setStats(next)
        setError(null)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError({ message: errorMessage(e), offline: e instanceof ApiError && e.isOffline })
      }
    },
    [range],
  )

  useEffect(() => {
    setStats(null)
    const controller = new AbortController()
    void load(controller.signal)
    // Today's numbers move while the shop is open. Older ranges only change at midnight, but a quiet refresh is cheap.
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(controller.signal)
    }, 60_000)
    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [load])

  const body = stats && stats.range === range ? <Report stats={stats} /> : null

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="text-display-lg font-bold">Statistics</h1>
          <p className="mt-1 text-body text-muted">
            {stats && stats.range === range ? (
              <>
                {stats.from === stats.to ? businessDayLabel(stats.from) : `${businessDayLabel(stats.from)} to ${businessDayLabel(stats.to)}`}. Updated {clockTime(stats.generatedAt)}.
              </>
            ) : (
              'How the shop is doing.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Download as CSV">
          <span className="mr-1 text-body-sm text-muted">Download CSV</span>
          {(['summary', 'orders', 'items'] as const).map((kind) => (
            <a key={kind} href={`/api/dashboard/stats/export?range=${range}&kind=${kind}`} download className={buttonClass({ variant: 'secondary', size: 'md' })}>
              <Download size={18} strokeWidth={1.75} aria-hidden="true" />
              {kind === 'summary' ? 'Summary' : kind === 'orders' ? 'Orders' : 'Items'}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <Tabs label="Period" value={range} onChange={(key) => setParams(key === 'today' ? {} : { range: key }, { replace: true })} tabs={RANGES} />
      </div>

      {error && !body && <ErrorState className="mt-6" title="The numbers didn't load" message={error.message} offline={error.offline} onRetry={() => void load()} />}
      {!body && !error && (
        <div role="status" className="mt-8">
          <LoadingLine label="Loading statistics" />
        </div>
      )}
      {body && error && (
        <p role="status" className="mt-4 text-body-sm text-warning">
          Couldn't refresh just now. These numbers are from {clockTime(stats?.generatedAt ?? null)}.
        </p>
      )}
      {body && <div className="mt-8">{body}</div>}
    </div>
  )
}

function Report({ stats }: { stats: StatsResponse }) {
  const { kpis: k, previous: p, comparisonLabel: vs } = stats

  if (k.orders === 0 && k.cancelled === 0) {
    return (
      <p className="rounded-lg border border-dashed border-control px-4 py-12 text-center text-body text-muted">
        No orders in this period yet. They appear here as soon as customers place them.
      </p>
    )
  }

  const sales = salesPoints(stats)
  const peakOrders = Math.max(0, ...stats.hours.map((h) => h.orders))
  const peakHour = stats.hours.find((h) => h.orders === peakOrders && peakOrders > 0)
  const hourPoints: HourPoint[] = stats.hours.map((h) => ({ label: hourLabel(h.hour), orders: h.orders, peak: peakOrders > 0 && h.orders === peakOrders }))

  const queuePoints: QueuePoint[] = stats.queue.map((q) => ({ label: q.label, avg: q.avg, max: q.max }))
  const worst = stats.queue.reduce<(typeof stats.queue)[number] | null>((best, q) => (q.max > (best?.max ?? 0) ? q : best), null)
  const busiestAverage = Math.max(0, ...stats.queue.map((q) => q.avg))

  const categoryTotal = stats.categories.reduce((sum, c) => sum + c.revenueFils, 0)
  const lateText = k.lateRate == null ? 'No data' : percentLabel(k.lateRate)

  // With no earlier period (the seed only reaches back 30 days, a new shop has none), say so once instead of on every number.
  const compare = p.orders > 0 || p.cancelled > 0
  const vsPrevious = (now: number | null, before: number | null, lowerIsBetter = false) =>
    compare ? <Delta now={now} before={before} comparisonLabel={vs} lowerIsBetter={lowerIsBetter} /> : null

  return (
    <>
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4 md:gap-x-8">
        <Kpi label="Revenue" delta={vsPrevious(k.revenueFils, p.revenueFils)}>
          {formatAedNumber(k.revenueFils)}
          <Unit>AED</Unit>
        </Kpi>
        <Kpi
          label="Orders"
          delta={
            <>
              {vsPrevious(k.orders, p.orders)}
              {k.cancelled > 0 && <p className="text-body-sm text-muted">{k.cancelled} cancelled</p>}
            </>
          }
        >
          {k.orders}
        </Kpi>
        <Kpi label="Average order" delta={vsPrevious(k.avgOrderFils, p.avgOrderFils)}>
          {k.avgOrderFils == null ? <span className="text-headline text-muted">No data</span> : formatAedNumber(k.avgOrderFils)}
          {k.avgOrderFils != null && <Unit>AED</Unit>}
        </Kpi>
        <Kpi label="Customers" delta={vsPrevious(k.customers, p.customers)}>
          {k.customers}
        </Kpi>
        <Kpi label="Time to make" delta={vsPrevious(k.avgPrepSeconds, p.avgPrepSeconds, true)}>
          <span className={k.avgPrepSeconds == null ? 'text-headline text-muted' : undefined}>{durationLabel(k.avgPrepSeconds)}</span>
        </Kpi>
        <Kpi label="Wait to start" delta={vsPrevious(k.avgWaitSeconds, p.avgWaitSeconds, true)}>
          <span className={k.avgWaitSeconds == null ? 'text-headline text-muted' : undefined}>{durationLabel(k.avgWaitSeconds)}</span>
        </Kpi>
        <Kpi label="Late orders" delta={vsPrevious(k.lateRate, p.lateRate, true)}>
          <span className={k.lateRate == null ? 'text-headline text-muted' : undefined}>{lateText}</span>
          {k.lateRate != null && <Unit>{k.lateOrders} late</Unit>}
        </Kpi>
        <Kpi label="Rating" delta={vsPrevious(k.rating, p.rating)}>
          {k.rating == null ? <span className="text-headline text-muted">No ratings yet</span> : k.rating.toFixed(1)}
          {k.rating != null && <Unit>of 5, {pluralise(k.ratingCount, 'rating')}</Unit>}
        </Kpi>
      </div>
      <p className="mt-4 text-body-sm text-muted">
        {compare ? `Compared with ${vs}.` : `Nothing to compare with yet (${vs}).`} Revenue counts paid orders only. Orders include ones still waiting for cash. Cancelled orders are left out of both.
      </p>

      <Section
        title="Sales"
        lead={
          <>
            {aed(k.revenueFils)} taken from {pluralise(k.orders, 'order')}.
          </>
        }
        className="mt-14"
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
          <ChartFrame
            summary={`${stats.range === 'today' ? 'Revenue by hour' : 'Revenue by day'}. ${aed(k.revenueFils)} in total.`}
            head={[stats.range === 'today' ? 'Hour' : 'Day', 'Revenue (AED)', 'Orders']}
            rows={sales.map((s) => [s.full, formatAedNumber(s.revenueFils), s.orders])}
          >
            <SalesChart data={sales} />
          </ChartFrame>
          <div className="grid content-start gap-6">
            <div className="border-t border-line pt-4">
              <p className="text-label font-semibold uppercase text-muted">Popular drink</p>
              {stats.popularDrink ? (
                <>
                  <p className="mt-2 font-display text-headline font-semibold leading-tight">{stats.popularDrink.name}</p>
                  <p className="text-body-sm text-muted tnum">
                    {stats.popularDrink.units} sold, {aed(stats.popularDrink.revenueFils)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-body text-muted">None sold yet.</p>
              )}
            </div>
            <div className="border-t border-line pt-4">
              <p className="text-label font-semibold uppercase text-muted">Popular snack</p>
              {stats.popularSnack ? (
                <>
                  <p className="mt-2 font-display text-headline font-semibold leading-tight">{stats.popularSnack.name}</p>
                  <p className="text-body-sm text-muted tnum">
                    {stats.popularSnack.units} sold, {aed(stats.popularSnack.revenueFils)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-body text-muted">None sold yet.</p>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Busy times"
        lead={peakHour ? `The busiest hour is ${hourLabel(peakHour.hour)} to ${hourLabel(peakHour.hour + 1)}, with ${pluralise(peakHour.orders, 'order')}.` : 'No orders to show by hour yet.'}
      >
        <div className="grid gap-10 xl:grid-cols-2 xl:gap-12">
          <div>
            <h3 className="mb-3 text-title font-semibold">Orders by hour</h3>
            <ChartFrame
              summary={peakHour ? `Orders by hour. Busiest at ${hourLabel(peakHour.hour)} with ${peakHour.orders}.` : 'Orders by hour. No orders yet.'}
              head={['Hour', 'Orders']}
              rows={hourPoints.map((h) => [h.label, h.orders])}
            >
              <HoursChart data={hourPoints} />
            </ChartFrame>
          </div>
          <div>
            <h3 className="mb-1 text-title font-semibold">Orders waiting to be started</h3>
            <p className="mb-3 text-body-sm text-muted">
              {worst && worst.max > 0
                ? `Longest line: ${pluralise(worst.max, 'order')} at ${worst.label} on the worst day. On an average day the most is ${busiestAverage.toFixed(1)}.`
                : 'Nobody waited for their order to be started.'}{' '}
              Solid line is the average, dashed is the worst day.
            </p>
            <ChartFrame
              summary={worst && worst.max > 0 ? `Orders waiting through the day. Longest line was ${worst.max} at ${worst.label}.` : 'Orders waiting through the day. No queue.'}
              head={['Time', 'Average waiting', 'Worst day']}
              rows={queuePoints.map((q) => [q.label, q.avg.toFixed(1), q.max])}
            >
              <QueueChart data={queuePoints} />
            </ChartFrame>
          </div>
        </div>
      </Section>

      <Section title="What sells" lead="Units sold, with sales before any discount.">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <h3 className="mb-3 text-title font-semibold">Top items</h3>
            <BarList
              empty="Nothing sold yet."
              rows={stats.topItems.map((i) => ({ key: i.name, label: i.name, value: i.units, text: `${i.units} sold`, sub: `${i.kind === 'drink' ? 'Drink' : 'Food'}, ${aed(i.revenueFils)}` }))}
            />
          </div>
          <div>
            <h3 className="mb-3 text-title font-semibold">Share of sales by category</h3>
            <BarList
              empty="Nothing sold yet."
              rows={stats.categories.map((c) => ({
                key: c.slug,
                label: c.name,
                value: c.revenueFils,
                text: categoryTotal > 0 ? percentLabel(c.revenueFils / categoryTotal) : '0%',
                sub: `${aed(c.revenueFils)}, ${pluralise(c.units, 'item')}`,
              }))}
            />
          </div>
        </div>
      </Section>

      <Section title="How people order" lead="Shares of orders in this period.">
        <div className="grid gap-8 md:grid-cols-3 md:gap-8">
          <Split
            title="Card and cash"
            a={{ label: 'Card', value: stats.payment.card.orders, sub: aed(stats.payment.card.revenueFils) }}
            b={{ label: 'Cash', value: stats.payment.cash.orders, sub: aed(stats.payment.cash.revenueFils) }}
          />
          <Split title="Now and pre-order" a={{ label: 'As soon as possible', value: stats.timing.asap }} b={{ label: 'Pre-order', value: stats.timing.preorder }} />
          <Split
            title="New and returning"
            a={{ label: 'First orders', value: stats.customerSplit.firstTimeOrders, sub: pluralise(stats.customerSplit.newCustomers, 'new customer') }}
            b={{
              label: 'Repeat orders',
              value: stats.customerSplit.repeatOrders,
              sub: stats.customerSplit.returningCustomers > 0 ? `${pluralise(stats.customerSplit.returningCustomers, 'customer')} from before this period` : undefined,
            }}
          />
        </div>
      </Section>

      <Section title="Speed" lead="Single-drink orders only, so one slow order does not skew the picture. An item needs three orders to be listed.">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <h3 className="mb-3 text-title font-semibold">Slowest to make</h3>
            <BarList
              empty="Not enough orders yet to say."
              rows={stats.slowest.map((s) => ({ key: s.name, label: s.name, value: s.avgSeconds, text: durationLabel(s.avgSeconds), sub: pluralise(s.samples, 'order') }))}
            />
          </div>
          <div>
            <h3 className="mb-3 text-title font-semibold">Least popular</h3>
            <BarList
              empty="Every item sold."
              rows={stats.leastPopular.map((l) => ({ key: l.name, label: l.name, value: l.units, text: l.units === 0 ? 'Not sold' : `${l.units} sold` }))}
            />
          </div>
        </div>
      </Section>

      <Section title="Loyalty" lead="Points customers earned in this period, and where all customers sit today.">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <h3 className="mb-1 text-title font-semibold">Points issued</h3>
            <p className="font-display text-display-lg font-bold leading-none tnum">{stats.loyalty.pointsIssued.toLocaleString('en-US')}</p>
            <div className="mt-2">
              {vsPrevious(stats.loyalty.pointsIssued, stats.loyalty.previousPointsIssued)}
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-title font-semibold">Customers by tier</h3>
            <BarList empty="No customers yet." highlight="none" rows={stats.loyalty.tiers.map((t) => ({ key: t.name, label: t.name, value: t.customers, text: pluralise(t.customers, 'customer') }))} />
          </div>
        </div>
      </Section>
    </>
  )
}
