import type { SlotsResponse } from '@shared/types'
import { useEffect, useState } from 'react'
import { cx } from '../../lib/cx'
import { LoadingLine } from '../ui/Art'

interface Props {
  slots: SlotsResponse | null
  error: string | null
  value: string | null
  onChange: (startsAt: string | null) => void
}

/**
 * Pick a day, then a time. Times run along a scrolling row; a slot that has filled up stays visible but
 * cannot be chosen, and says "Full" in words.
 */
export function SlotPicker({ slots, error, value, onChange }: Props) {
  const [dayIndex, setDayIndex] = useState(0)

  // If today has nothing left, start on the first day that does.
  useEffect(() => {
    if (!slots) return
    const first = slots.days.findIndex((d) => d.slots.length > 0)
    if (first > 0 && slots.days[0].slots.length === 0) setDayIndex(first)
  }, [slots])

  if (error && !slots) return <p role="alert" className="text-body-sm text-danger">{error}</p>
  if (!slots) {
    return (
      <div role="status">
        <LoadingLine label="Finding pickup times" />
      </div>
    )
  }

  const day = slots.days[Math.min(dayIndex, slots.days.length - 1)]

  return (
    <div>
      <div role="tablist" aria-label="Day" className="mb-3 inline-flex rounded-md border border-control p-0.5">
        {slots.days.map((d, i) => (
          <button
            key={d.date}
            role="tab"
            type="button"
            aria-selected={i === dayIndex}
            onClick={() => {
              setDayIndex(i)
              onChange(null)
            }}
            className={cx(
              'min-h-10 rounded-sm px-4 text-body-sm font-semibold transition-colors',
              i === dayIndex ? 'bg-raised text-ink shadow-[inset_0_-2px_0_var(--c-accent)]' : 'text-muted hover:text-ink',
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      {day.closed ? (
        <p className="text-body text-muted">We're closed {day.label === 'Today' ? 'today' : day.label.toLowerCase()}.</p>
      ) : day.slots.length === 0 ? (
        <p className="text-body text-muted">No pickup times left {day.label === 'Today' ? 'today' : day.label.toLowerCase()}. {slots.days.length > 1 ? 'Try another day, or order as soon as possible.' : 'Order as soon as possible instead.'}</p>
      ) : (
        <>
          <div role="radiogroup" aria-label={`Pickup times ${day.label}`} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] md:mx-0 md:max-h-52 md:flex-wrap md:overflow-y-auto md:px-0">
            {day.slots.map((slot) => {
              const selected = value === slot.startsAt
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={slot.full}
                  onClick={() => onChange(slot.startsAt)}
                  aria-label={slot.full ? `${slot.label}, full` : `${slot.label}${selected ? ', selected' : ''}`}
                  className={cx(
                    'flex min-h-12 min-w-18 shrink-0 flex-col items-center justify-center rounded-md border px-3 text-body font-semibold tnum transition-colors',
                    selected
                      ? 'border-accent bg-accent text-on-accent'
                      : slot.full
                        ? 'border-line text-muted'
                        : 'border-control text-ink hover:bg-raised',
                  )}
                >
                  {slot.label}
                  {slot.full && <span className="text-label font-semibold uppercase">Full</span>}
                </button>
              )
            })}
          </div>
          <p className="text-body-sm text-muted">Open {day.hours}. Times are in {slots.slotMinutes} minute steps.</p>
        </>
      )}
    </div>
  )
}
