import type { EventPost } from '@shared/events'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Markdown } from '../../components/events/Markdown'
import { Cover, InterestButton, whenAndWhere } from '../../components/events/parts'
import { LoadingLine } from '../../components/ui/Art'
import { LinkButton } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/Chip'
import { EmptyState, ErrorState } from '../../components/ui/States'
import { ApiError, api, errorMessage } from '../../lib/api'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

export function EventPage() {
  const { id } = useParams()
  const [post, setPost] = useState<EventPost | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [error, setError] = useState<{ message: string; offline: boolean } | null>(null)
  useDocumentTitle(post?.title ?? 'Event')

  useEffect(() => {
    let cancelled = false
    setState('loading')
    api<{ post: EventPost }>(`/events/${encodeURIComponent(id ?? '')}`)
      .then((r) => {
        if (cancelled) return
        setPost(r.post)
        setState('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 404) setState('missing')
        else {
          setError({ message: errorMessage(e), offline: e instanceof ApiError && e.isOffline })
          setState('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (state === 'loading') {
    return (
      <div role="status" className="max-w-md pt-4">
        <LoadingLine label="Loading" />
      </div>
    )
  }
  if (state === 'missing') {
    return (
      <EmptyState
        className="max-w-2xl"
        title="We couldn't find that post"
        action={
          <LinkButton to="/events" variant="secondary" size="md">
            All events and clubs
          </LinkButton>
        }
      >
        It may not be public yet, or the club has taken it down.
      </EmptyState>
    )
  }
  if (state === 'error' || !post) {
    return <ErrorState message={error?.message ?? ''} offline={error?.offline} title="That didn't load" className="max-w-xl" />
  }

  const where = whenAndWhere(post)
  return (
    <article className="max-w-3xl">
      <Link to="/events" className="inline-flex min-h-11 items-center text-body-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
        All events and clubs
      </Link>
      <Cover src={post.coverImage} seed={post.id} startsAt={post.startsAt} className="mt-2 aspect-[16/8] w-full rounded-lg border border-line" />
      <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-label font-semibold uppercase text-muted">
        {post.kind === 'event' ? 'Event' : 'Post'}
        <span aria-hidden="true">·</span>
        {post.club}
        {post.isSample && <StatusChip className="normal-case">Sample</StatusChip>}
      </p>
      <h1 className="mt-1 text-display-lg font-bold">{post.title}</h1>
      {where && <p className="mt-2 text-title font-semibold text-ink tnum">{where}</p>}
      <Markdown text={post.body} className="mt-6" />
      <div className="mt-8 border-t border-line pt-5">
        <InterestButton post={post} onChange={(next) => setPost({ ...post, ...next })} />
      </div>
    </article>
  )
}
