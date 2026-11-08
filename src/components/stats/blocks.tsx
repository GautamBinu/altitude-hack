import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { change } from '@shared/stats'
import { cx } from '../../lib/cx'
import { percentLabel } from '../../lib/format'

/** A section of the statistics page: a heading, one sentence stating the main number, then the content. */
export function Section({ title, lead, children, className }: { title: string; lead?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cx('mt-12 first:mt-0 md:mt-14', className)}>
      <h2 className="text-headline font-semibold">{title}</h2>
      {lead && <p className="mt-1 text-body text-muted">{lead}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

interface DeltaProps {
  now: number | null
  before: number | null
  comparisonLabel: string
  /** For times and late orders a fall is good news. */
  lowerIsBetter?: boolean
}

/** "Up 12% on yesterday by this time". Direction is an arrow and words as well as colour. */
export function Delta({ now, before, comparisonLabel, lowerIsBetter = false }: DeltaProps) {
  const c = change(now, before)
  if (c == null) return <p className="text-body-sm text-muted">Nothing to compare with yet</p>
  const rounded = Math.round(Math.abs(c) * 100)
  if (rounded === 0) {
    return (
      <p className="flex items-center gap-1 text-body-sm text-muted">
        <Minus size={14} strokeWidth={2} aria-hidden="true" />
        Same as {comparisonLabel}
      </p>
    )
  }
  const up = c > 0
  const good = up !== lowerIsBetter
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <p className={cx('flex items-center gap-1 text-body-sm', good ? 'text-success' : 'text-danger')}>
      <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
      {up ? 'Up' : 'Down'} {rounded}% on {comparisonLabel}
    </p>
  )
}

/** One headline number with its label and comparison. Separated by hairlines, not boxed. */
export function Kpi({ label, children, delta }: { label: string; children: ReactNode; delta?: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-line pt-4">
      <p className="text-label font-semibold uppercase text-muted">{label}</p>
      <div className="mt-2 flex min-h-10 items-end font-display text-display-lg font-bold leading-none tnum text-ink">{children}</div>
      <div className="mt-2 min-h-5">{delta}</div>
    </div>
  )
}

/** The small unit that sits beside a headline number. */
export function Unit({ children }: { children: ReactNode }) {
  return <span className="ml-1.5 pb-0.5 font-sans text-label font-semibold uppercase text-muted">{children}</span>
}

interface BarRow {
  key: string
  label: string
  /** What the bar is sized by. */
  value: number
  /** The words printed at the end of the row. */
  text: string
  sub?: string
}

/** Rows with a proportional bar behind a label and the figure in words. Reads as a list, so nothing relies on the bar alone. */
export function BarList({
  rows,
  empty,
  highlight = 'first',
}: {
  rows: BarRow[]
  empty: string
  /** In a ranking the first row is the one that matters. Use 'none' when no row is more important than another. */
  highlight?: 'first' | 'none'
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) return <p className="rounded-lg border border-dashed border-control px-4 py-6 text-center text-body text-muted">{empty}</p>
  return (
    <ol className="grid gap-3">
      {rows.map((r, i) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-body text-ink">{r.label}</span>
            <span className="shrink-0 text-body-sm text-muted tnum">{r.text}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-sm bg-raised" aria-hidden="true">
            <div
              className={cx('h-full rounded-sm', highlight === 'first' && i === 0 ? 'bg-accent' : 'bg-control')}
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
          {r.sub && <p className="mt-1 text-body-sm text-muted">{r.sub}</p>}
        </li>
      ))}
    </ol>
  )
}

interface SplitPart {
  label: string
  value: number
  sub?: string
}

/** Two shares of one whole, side by side. The numbers are printed, the bar only helps the eye. */
export function Split({ title, a, b }: { title: string; a: SplitPart; b: SplitPart }) {
  const total = a.value + b.value
  const share = total === 0 ? 0 : a.value / total
  return (
    <div className="border-t border-line pt-4">
      <h3 className="text-title font-semibold">{title}</h3>
      {total === 0 ? (
        <p className="mt-3 text-body text-muted">No orders yet.</p>
      ) : (
        <>
          <div className="mt-3 flex h-3 overflow-hidden rounded-sm bg-raised" aria-hidden="true">
            <div className="h-full bg-accent" style={{ width: `${share * 100}%` }} />
            <div className="h-full bg-control" style={{ width: `${(1 - share) * 100}%` }} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <dt className="flex items-center gap-2 text-body-sm text-muted">
                <span className="size-2.5 rounded-sm bg-accent" aria-hidden="true" />
                {a.label}
              </dt>
              <dd className="mt-1 font-display text-headline font-semibold tnum">
                {percentLabel(share)}
                <span className="ml-2 font-sans text-body-sm font-normal text-muted">{a.value}</span>
              </dd>
              {a.sub && <dd className="text-body-sm text-muted tnum">{a.sub}</dd>}
            </div>
            <div>
              <dt className="flex items-center gap-2 text-body-sm text-muted">
                <span className="size-2.5 rounded-sm bg-control" aria-hidden="true" />
                {b.label}
              </dt>
              <dd className="mt-1 font-display text-headline font-semibold tnum">
                {percentLabel(1 - share)}
                <span className="ml-2 font-sans text-body-sm font-normal text-muted">{b.value}</span>
              </dd>
              {b.sub && <dd className="text-body-sm text-muted tnum">{b.sub}</dd>}
            </div>
          </dl>
        </>
      )}
    </div>
  )
}

/** A chart with a plain-language summary for screen readers and a table of the same numbers they can read through. */
export function ChartFrame({
  summary,
  head,
  rows,
  children,
}: {
  summary: string
  head: string[]
  rows: (string | number)[][]
  children: ReactNode
}) {
  return (
    <figure className="m-0">
      <div role="img" aria-label={summary}>
        {children}
      </div>
      <div className="sr-only">
        <table>
        <caption>{summary}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </figure>
  )
}
