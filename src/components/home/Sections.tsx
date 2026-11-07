import { describeSelections } from '@shared/modifiers'
import type { HomeBanner, HomeEvent, MenuItem, UsualResponse } from '@shared/types'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../ui/Button'
import { inputClass } from '../ui/Fields'
import { selectionsFor } from '../../lib/reorder'

/** The start of "What are you in the mood for?": type a few words here and the answer is on the next screen. */
export function MoodEntry() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const go = (e: FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    navigate(value ? `/mood?q=${encodeURIComponent(value)}` : '/mood')
  }
  return (
    <section aria-labelledby="mood-entry-heading">
      <h2 id="mood-entry-heading" className="text-headline font-semibold">
        What are you in the mood for?
      </h2>
      <p className="mt-1 text-body text-muted">Tell us in a few words and we will pick three drinks.</p>
      <form onSubmit={go} className="mt-3 flex flex-wrap gap-3">
        <label htmlFor="mood-entry-text" className="sr-only">
          Your mood
        </label>
        <input
          id="mood-entry-text"
          type="text"
          value={text}
          maxLength={300}
          autoComplete="off"
          enterKeyHint="go"
          onChange={(e) => setText(e.target.value)}
          placeholder="Rainy, tired, something sweet"
          className={`${inputClass} min-w-0 flex-1 basis-64 border-control`}
        />
        <Button type="submit" size="lg" variant="secondary">
          Find a drink
        </Button>
      </form>
    </section>
  )
}

/** "Tue 10 Nov, 17:00" in the viewer's clock. */
export function eventWhen(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

interface UsualProps {
  usual: UsualResponse
  itemsById: Map<number, MenuItem>
  onOrderUsual: () => void
  onOrderLast: () => void
}

/** One-tap reorder for returning members: their most repeated order, and their last order again. */
export function ReorderSection({ usual, itemsById, onOrderUsual, onOrderLast }: UsualProps) {
  const item = usual.usual ? itemsById.get(usual.usual.itemId) : undefined
  const showUsual = !!usual.usual && !!item && !item.soldOut
  const lastLines = usual.last?.lines.filter((l) => itemsById.get(l.itemId) && !itemsById.get(l.itemId)!.soldOut) ?? []
  const showLast = lastLines.length > 0 && !!usual.last
  if (!showUsual && !showLast) return null

  const labels = item && usual.usual ? describeSelections(item.groups, selectionsFor(item, usual.usual.selections)) : []

  return (
    <section aria-labelledby="usual-heading">
      <h2 id="usual-heading" className="text-headline font-semibold">
        Your usual
      </h2>
      <div className="mt-3 divide-y divide-line border-y border-line">
        {showUsual && item && usual.usual && (
          <div className="flex min-h-20 flex-wrap items-center justify-between gap-x-4 gap-y-3 py-3">
            <div className="min-w-0">
              <p className="text-title font-semibold leading-snug">{item.name}</p>
              <p className="text-body-sm text-muted">{[...labels, usual.usual.note].filter(Boolean).join(' · ') || `Ordered ${usual.usual.count} times`}</p>
            </div>
            <Button size="md" onClick={onOrderUsual}>
              Order it again
            </Button>
          </div>
        )}
        {showLast && usual.last && (
          <div className="flex min-h-20 flex-wrap items-center justify-between gap-x-4 gap-y-3 py-3">
            <div className="min-w-0">
              <p className="text-title font-semibold leading-snug">Last order, #{usual.last.number}</p>
              <p className="truncate text-body-sm text-muted">
                {lastLines.map((l) => `${l.quantity} × ${itemsById.get(l.itemId)!.name}`).join(', ')}
              </p>
            </div>
            <Button size="md" variant="secondary" onClick={onOrderLast}>
              Repeat it
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

/** Up to two active promotions, set by marketing. Text first; a photo when there is one. */
export function Banners({ banners, itemsById, onOrder }: { banners: HomeBanner[]; itemsById: Map<number, MenuItem>; onOrder: (item: MenuItem) => void }) {
  if (banners.length === 0) return null
  return (
    <section aria-label="Offers" className="grid gap-3">
      {banners.map((banner) => {
        const item = banner.itemId != null ? itemsById.get(banner.itemId) : undefined
        return (
          <div key={banner.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-line bg-surface p-5">
            <div className="min-w-0 flex-1 basis-56">
              <p className="font-display text-headline font-semibold leading-tight">{banner.title}</p>
              {banner.body && <p className="mt-1 text-body text-muted">{banner.body}</p>}
            </div>
            {item && !item.soldOut && (
              <Button size="md" variant="secondary" onClick={() => onOrder(item)}>
                See {item.name}
              </Button>
            )}
          </div>
        )
      })}
    </section>
  )
}

/** A short list of what is coming up on campus. */
export function EventsPreview({ events }: { events: HomeEvent[] }) {
  if (events.length === 0) return null
  return (
    <section aria-labelledby="events-preview-heading">
      <h2 id="events-preview-heading" className="text-headline font-semibold">
        Coming up
      </h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {events.map((event) => (
          <li key={event.id} className="py-3">
            <p className="text-title font-semibold leading-snug">{event.title}</p>
            <p className="text-body-sm text-muted">
              {event.club}
              {event.startsAt ? ` · ${eventWhen(event.startsAt)}` : ''}
              {event.place ? ` · ${event.place}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
