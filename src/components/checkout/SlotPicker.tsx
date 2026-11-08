import { clockLabel, parseClockTime, resolveTyped, stepSlot } from '@shared/clock'
import type { SlotsResponse } from '@shared/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { cx } from '../../lib/cx'
import { LoadingLine } from '../ui/Art'
import { inputClass } from '../ui/Fields'

interface Props {
  slots: SlotsResponse | null
  error: string | null
  value: string | null
  onChange: (startsAt: string | null) => void
}

type Note = { tone: 'info' | 'error'; text: string } | null

/**
 * Pick a day, then type a time or step with the arrows. A time that is between two slots or already full moves to the
 * next free one and says so. The arrows skip full slots, so the customer never lands on one.
 */
export function SlotPicker({ slots, error, value, onChange }: Props) {
  const [dayIndex, setDayIndex] = useState(0)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState<Note>(null)
  const inputId = useId()
  const helpId = useId()

  // If today has nothing left, start on the first day that does.
  useEffect(() => {
    if (!slots) return
    const first = slots.days.findIndex((d) => d.slots.length > 0)
    if (first > 0 && slots.days[0].slots.length === 0) setDayIndex(first)
  }, [slots])

  const day = slots ? slots.days[Math.min(dayIndex, slots.days.length - 1)] : null
  const list = day?.slots ?? []
  const selectedIndex = value ? list.findIndex((s) => s.startsAt === value) : -1

  // Show the chosen time in the box, however it was chosen.
  useEffect(() => {
    const slot = list.find((s) => s.startsAt === value)
    if (slot) setText(slot.label)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const commit = (raw: string, quiet: boolean) => {
    setEditing(false)
    const trimmed = raw.trim()
    if (!trimmed) return
    const parsed = parseClockTime(trimmed)
    if (!parsed) {
      if (!quiet) setNote({ tone: 'error', text: 'Type a time like 14:30 or 2:30 pm.' })
      return
    }
    let minutes = parsed.minutes
    let pick = resolveTyped(list, minutes)
    // "2:30" with no am or pm, when the shop is only open in the afternoon, means 14:30.
    if (pick.kind === 'before' && !parsed.meridiem && minutes < 12 * 60) {
      const afternoon = resolveTyped(list, minutes + 12 * 60)
      if (afternoon.kind === 'exact' || afternoon.kind === 'moved') {
        pick = afternoon
        minutes += 12 * 60
      }
    }
    const typed = clockLabel(minutes)
    if (pick.kind === 'exact' || pick.kind === 'moved') {
      const slot = list[pick.index]
      onChange(slot.startsAt)
      setText(slot.label)
      setNote(pick.kind === 'exact' ? null : { tone: 'info', text: `${typed} ${pick.because === 'full' ? 'is full' : "isn't a pickup time"}. Moved to ${slot.label}.` })
      return
    }
    onChange(null)
    if (pick.kind === 'before') setNote({ tone: 'error', text: `Pickup starts at ${list[0].label}.` })
    else if (pick.kind === 'after') setNote({ tone: 'error', text: `The last pickup is ${list[list.length - 1].label}.` })
    else setNote({ tone: 'error', text: `Nothing is free from ${typed}. Try an earlier time.` })
  }

  // Once typing pauses, set the time without waiting for the customer to leave the box.
  useEffect(() => {
    if (!editing) return
    const timer = window.setTimeout(() => commit(text, true), 700)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, editing])

  if (error && !slots) return <p role="alert" className="text-body-sm text-danger">{error}</p>
  if (!slots || !day) {
    return (
      <div role="status">
        <LoadingLine label="Finding pickup times" />
      </div>
    )
  }

  // Arrows step from the chosen slot, or from what has been typed so far.
  let anchor: number | null = selectedIndex >= 0 ? selectedIndex : null
  if (anchor === null && text.trim()) {
    const parsed = parseClockTime(text)
    const near = parsed ? resolveTyped(list, parsed.minutes) : null
    if (near && (near.kind === 'exact' || near.kind === 'moved')) anchor = near.index
  }
  const canEarlier = stepSlot(list, anchor, -1) !== null
  const canLater = stepSlot(list, anchor, 1) !== null

  const step = (direction: 1 | -1) => {
    const next = stepSlot(list, anchor, direction)
    if (next === null) return
    onChange(list[next].startsAt)
    setText(list[next].label)
    setEditing(false)
    setNote(null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      step(1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      step(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commit(text, false)
    }
  }

  const full = list.filter((s) => s.full).map((s) => s.label)
  const arrow = 'grid size-12 shrink-0 place-items-center rounded-md border border-control text-ink transition-colors hover:bg-raised disabled:border-line disabled:text-muted disabled:hover:bg-transparent'

  return (
    <div>
      <div role="tablist" aria-label="Day" className="mb-4 inline-flex rounded-md border border-control p-0.5">
        {slots.days.map((d, i) => (
          <button
            key={d.date}
            role="tab"
            type="button"
            aria-selected={i === dayIndex}
            onClick={() => {
              setDayIndex(i)
              onChange(null)
              setText('')
              setEditing(false)
              setNote(null)
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
      ) : list.length === 0 ? (
        <p className="text-body text-muted">No pickup times left {day.label === 'Today' ? 'today' : day.label.toLowerCase()}. {slots.days.length > 1 ? 'Try another day, or order as soon as possible.' : 'Order as soon as possible instead.'}</p>
      ) : (
        <div>
          <label htmlFor={inputId} className="mb-1.5 block text-body-sm font-semibold text-ink">
            Pickup time
          </label>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Earlier pickup time" disabled={!canEarlier} onClick={() => step(-1)} className={arrow}>
              <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <div className="w-36">
              <input
                id={inputId}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="done"
                placeholder="14:30"
                value={text}
                aria-describedby={helpId}
                aria-invalid={note?.tone === 'error' ? true : undefined}
                onChange={(e) => {
                  setText(e.target.value)
                  setEditing(true)
                  setNote(null)
                  // A half-typed time is not a choice yet, so checkout waits for it.
                  if (value) onChange(null)
                }}
                onBlur={() => editing && commit(text, false)}
                onKeyDown={onKeyDown}
                className={cx(inputClass, 'text-center font-display text-headline font-semibold tnum', note?.tone === 'error' ? 'border-danger' : 'border-control')}
              />
            </div>
            <button type="button" aria-label="Later pickup time" disabled={!canLater} onClick={() => step(1)} className={arrow}>
              <ChevronRight size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          {note && (
            <p role="status" className={cx('mt-2 text-body-sm', note.tone === 'error' ? 'text-danger' : 'text-ink')}>
              {note.text}
            </p>
          )}
          <p id={helpId} className="mt-2 text-body-sm text-muted">
            Type a time like 14:30, or use the arrows. Open {day.hours}, in {slots.slotMinutes} minute steps.
            {full.length > 0 && ` Full: ${full.slice(0, 6).join(', ')}${full.length > 6 ? ` and ${full.length - 6} more` : ''}.`}
          </p>
        </div>
      )}
    </div>
  )
}