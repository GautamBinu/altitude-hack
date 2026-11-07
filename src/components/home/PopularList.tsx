import type { HomeResponse, MenuItem } from '@shared/types'
import { Plus } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { cx } from '../../lib/cx'
import { Price } from '../ui/Price'

type Window = 'today' | 'week'

interface Props {
  popular: HomeResponse['popular']
  itemsById: Map<number, MenuItem>
  onOpen: (item: MenuItem) => void
}

function countPhrase(count: number, windowKey: Window, label: string): string {
  const times = count === 1 ? '1 time' : `${count.toLocaleString('en-US')} times`
  if (windowKey === 'week') return `ordered ${times} this week`
  return label === 'Today' ? `ordered ${times} today` : `ordered ${times} in the last 24 hours`
}

/** Best sellers on campus, counted from real order history. Switch between today and the last 7 days. */
export function PopularList({ popular, itemsById, onOpen }: Props) {
  const [windowKey, setWindowKey] = useState<Window>('today')
  const headingId = useId()
  const current = windowKey === 'today' ? popular.today : popular.week

  const rows = useMemo(
    () =>
      current.items
        .map((entry) => ({ entry, item: itemsById.get(entry.itemId) }))
        .filter((row): row is { entry: typeof row.entry; item: MenuItem } => !!row.item && !row.item.soldOut)
        .slice(0, 5),
    [current, itemsById],
  )

  if (popular.today.items.length === 0 && popular.week.items.length === 0) return null

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={headingId} className="text-headline font-semibold">
          Popular on campus
        </h2>
        <div role="tablist" aria-label="Time range" className="inline-flex rounded-md border border-control p-0.5">
          {(
            [
              ['today', popular.today.label === 'Today' ? 'Today' : '24 hours'],
              ['week', '7 days'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={windowKey === key}
              onClick={() => setWindowKey(key)}
              className={cx(
                'min-h-10 rounded-sm px-4 text-body-sm font-semibold transition-colors',
                windowKey === key ? 'bg-raised text-ink shadow-[inset_0_-2px_0_var(--c-accent)]' : 'text-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-body text-muted">Nothing ordered in this window yet.</p>
      ) : (
        <ol className="mt-3 divide-y divide-line border-y border-line">
          {rows.map(({ entry, item }, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="group flex min-h-16 w-full items-center gap-4 py-2 text-left transition-colors hover:bg-surface"
                aria-label={`${item.name}, ${countPhrase(entry.count, windowKey, current.label)}. Choose options and add.`}
              >
                <span className="w-8 shrink-0 text-center font-display text-headline font-semibold text-muted tnum" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-title font-semibold leading-snug">{item.name}</span>
                  <span className="block text-body-sm text-muted tnum">{countPhrase(entry.count, windowKey, current.label)}</span>
                </span>
                <Price fils={item.priceFils} size="sm" />
                <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-md border border-control text-ink transition-colors group-hover:bg-raised">
                  <Plus size={20} strokeWidth={1.75} />
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
