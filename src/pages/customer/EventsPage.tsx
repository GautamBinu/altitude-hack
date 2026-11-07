import type { EventFeed, EventPost } from '@shared/events'
import { markdownToPlain } from '@shared/markdown'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { InterestButton, Cover, MyPosts, whenAndWhere } from '../../components/events/parts'
import { LoadingLine } from '../../components/ui/Art'
import { LinkButton } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/Chip'
import { inputClass } from '../../components/ui/Fields'
import { EmptyState, ErrorState } from '../../components/ui/States'
import { ApiError, api, errorMessage } from '../../lib/api'
import { cx } from '../../lib/cx'
import { useLiveRefresh } from '../../lib/liveEvents'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

type When = 'upcoming' | 'past'

function EventCard({ post, onChange }: { post: EventPost; onChange: (next: Pick<EventPost, 'interested' | 'interestCount'>) => void }) {
  const where = whenAndWhere(post)
  return (
    <article className="grid overflow-hidden rounded-lg border border-line bg-surface md:grid-cols-[15rem_minmax(0,1fr)]">
      <Link to={`/events/${post.id}`} tabIndex={-1} aria-hidden="true" className="block">
        <Cover src={post.coverImage} seed={post.id} startsAt={post.startsAt} className="aspect-[16/8] md:aspect-auto md:h-full md:min-h-44" />
      </Link>
      <div className="flex flex-col gap-2 p-4 md:p-5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label font-semibold uppercase text-muted">
          {post.kind === 'event' ? 'Event' : 'Post'}
          <span aria-hidden="true">·</span>
          {post.club}
          {post.isSample && <StatusChip className="normal-case">Sample</StatusChip>}
        </p>
        <h2 className="font-display text-headline font-semibold leading-tight">
          <Link to={`/events/${post.id}`} className="hover:underline hover:underline-offset-4">
            {post.title}
          </Link>
        </h2>
        {where && <p className="text-body font-semibold text-ink tnum">{where}</p>}
        <p className="line-clamp-2 text-body text-muted">{markdownToPlain(post.body, 180)}</p>
        <div className="mt-auto pt-2">
          <InterestButton post={post} onChange={onChange} />
        </div>
      </div>
    </article>
  )
}

export function EventsPage() {
  useDocumentTitle('Events and clubs')
  const [when, setWhen] = useState<When>('upcoming')
  const [club, setClub] = useState('')
  const [feed, setFeed] = useState<EventFeed | null>(null)
  const [allClubs, setAllClubs] = useState<string[]>([])
  const [error, setError] = useState<{ message: string; offline: boolean } | null>(null)
  const [refresh, setRefresh] = useState(0)

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ when })
      if (club) params.set('club', club)
      const data = await api<EventFeed>(`/events?${params}`)
      setFeed(data)
      setError(null)
      // The club list always shows every club, whatever tab is open.
      setAllClubs((current) => [...new Set([...current, ...data.clubs])].sort((a, b) => a.localeCompare(b)))
    } catch (e) {
      setError({ message: errorMessage(e), offline: e instanceof ApiError && e.isOffline })
    }
  }, [when, club])

  useEffect(() => {
    setFeed(null)
    void load()
  }, [load])
  useLiveRefresh(() => {
    void load()
    setRefresh((n) => n + 1)
  })

  const patch = (id: number, next: Pick<EventPost, 'interested' | 'interestCount'>) =>
    setFeed((current) => (current ? { ...current, posts: current.posts.map((p) => (p.id === id ? { ...p, ...next } : p)) } : current))

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-display-lg font-bold">Events and clubs</h1>
          <p className="mt-2 max-w-xl text-body text-muted">What is on around campus. Anyone can share an event or a post. The team reads each one first.</p>
        </div>
        <LinkButton to="/events/new" size="lg">
          Share an event or post
        </LinkButton>
      </div>

      <div className="mt-8">
        <MyPosts refreshKey={refresh} />
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div role="tablist" aria-label="When" className="inline-flex rounded-md border border-control p-0.5">
          {(['upcoming', 'past'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={when === key}
              onClick={() => setWhen(key)}
              className={cx(
                'min-h-11 rounded-sm px-4 text-body-sm font-semibold transition-colors',
                when === key ? 'bg-raised text-ink shadow-[inset_0_-2px_0_var(--c-accent)]' : 'text-muted hover:text-ink',
              )}
            >
              {key === 'upcoming' ? 'Upcoming' : 'Past'}
            </button>
          ))}
        </div>
        {allClubs.length > 1 && (
          <div>
            <label htmlFor="club-filter" className="mb-1 block text-body-sm font-semibold text-ink">
              Club
            </label>
            <select id="club-filter" value={club} onChange={(e) => setClub(e.target.value)} className={cx(inputClass, 'w-auto min-w-52 border-control')}>
              <option value="">All clubs</option>
              {allClubs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-6" aria-live="polite">
        {error && !feed && <ErrorState title="The events didn't load" message={error.message} offline={error.offline} onRetry={() => void load()} />}
        {!feed && !error && (
          <div role="status">
            <LoadingLine label="Loading events" />
          </div>
        )}
        {feed && feed.posts.length === 0 && (
          <EmptyState
            title={when === 'upcoming' ? 'Nothing coming up' : 'Nothing in the past yet'}
            action={
              <LinkButton to="/events/new" variant="secondary" size="md">
                Share something
              </LinkButton>
            }
          >
            {club ? `No posts from ${club} here.` : 'Be the first to put something on the board.'}
          </EmptyState>
        )}
        {feed && feed.posts.length > 0 && (
          <ul className="grid gap-4">
            {feed.posts.map((post) => (
              <li key={post.id}>
                <EventCard post={post} onChange={(next) => patch(post.id, next)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
