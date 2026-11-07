import type { EventPost, MySubmission } from '@shared/events'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api, errorMessage } from '../../lib/api'
import { cx } from '../../lib/cx'
import { eventWhen, pluralise } from '../../lib/format'
import { forgetPost, savedPostTokens, tokenFor } from '../../lib/myPosts'
import { useSession } from '../../state/session'
import { Mountains } from '../ui/Art'
import { Button } from '../ui/Button'
import { StatusChip } from '../ui/Chip'
import { useToast } from '../ui/Toast'

/**
 * A post's picture, or the quiet ridge when it has none. An event without a picture puts its date on the ridge,
 * so the empty space tells you when it is.
 */
export function Cover({ src, seed, className, startsAt }: { src: string | null; seed: number; className?: string; startsAt?: string | null }) {
  const [failed, setFailed] = useState(false)
  const showPicture = !!src && !failed
  const date = !showPicture && startsAt ? new Date(startsAt) : null
  return (
    <div className={cx('relative overflow-hidden bg-raised', className)}>
      {showPicture ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <div className="absolute inset-x-0 bottom-0 h-1/2">
            <Mountains flip={seed % 2 === 1} />
          </div>
          {date && (
            <div className="absolute top-3 left-4 leading-none text-ink" aria-hidden="true">
              <span className="block text-label font-semibold uppercase text-muted">{date.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
              <span className="mt-1 block font-display text-display-lg font-bold tnum">{date.getDate()}</span>
              <span className="mt-1 block text-label font-semibold uppercase text-muted">{date.toLocaleDateString('en-GB', { month: 'short' })}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** "I'm interested". One tap, no sign-in. The count updates straight away and is corrected if it fails. */
export function InterestButton({ post, onChange }: { post: EventPost; onChange: (next: Pick<EventPost, 'interested' | 'interestCount'>) => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const toggle = async () => {
    if (busy) return
    const on = !post.interested
    const before = { interested: post.interested, interestCount: post.interestCount }
    onChange({ interested: on, interestCount: Math.max(0, post.interestCount + (on ? 1 : -1)) })
    setBusy(true)
    try {
      const r = await api<{ interested: boolean; interestCount: number }>(`/events/${post.id}/interest`, { body: { on } })
      onChange({ interested: r.interested, interestCount: r.interestCount })
    } catch (e) {
      onChange(before)
      toast.show(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button variant={post.interested ? 'primary' : 'secondary'} size="md" aria-pressed={post.interested} onClick={() => void toggle()}>
        {post.interested ? "You're interested" : "I'm interested"}
      </Button>
      <span className="text-body-sm text-muted tnum" aria-live="polite">
        {post.interestCount === 0 ? 'Be the first' : `${post.interestCount} interested`}
      </span>
    </div>
  )
}

/** When and where, in one line. */
export function whenAndWhere(post: Pick<EventPost, 'startsAt' | 'place'>): string {
  return [post.startsAt ? eventWhen(post.startsAt) : null, post.place].filter(Boolean).join(' · ')
}

const STATUS_CHIP = {
  pending: { tone: 'neutral', text: 'Pending review' },
  approved: { tone: 'success', text: 'Public' },
  rejected: { tone: 'warning', text: 'Not approved' },
  unpublished: { tone: 'neutral', text: 'Taken down' },
} as const

/** The posts this person has sent, with where each one stands. Nothing shows when they have sent none. */
export function MyPosts({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user } = useSession()
  const toast = useToast()
  const [posts, setPosts] = useState<MySubmission[]>([])

  const load = useCallback(() => {
    const tokens = savedPostTokens().map((p) => p.token)
    if (!user && tokens.length === 0) {
      setPosts([])
      return
    }
    api<{ posts: MySubmission[] }>('/events/status', { body: { tokens } })
      .then((r) => setPosts(r.posts))
      .catch(() => {})
  }, [user])
  useEffect(load, [load, refreshKey])

  if (posts.length === 0) return null

  const withdraw = async (post: MySubmission) => {
    try {
      await api(`/events/${post.id}/withdraw`, { body: { token: tokenFor(post.id) ?? undefined } })
      forgetPost(post.id)
      toast.show(`${post.title} was taken back.`)
      load()
    } catch (e) {
      toast.show(errorMessage(e), 'error')
    }
  }

  return (
    <section aria-labelledby="my-posts-heading" className="mb-8">
      <h2 id="my-posts-heading" className="text-headline font-semibold">
        Your posts
      </h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {posts.map((post) => {
          const chip = STATUS_CHIP[post.status]
          return (
            <li key={post.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-title font-semibold leading-snug">
                  {post.title}
                  <StatusChip tone={chip.tone}>{chip.text}</StatusChip>
                </p>
                <p className="text-body-sm text-muted">
                  {post.club}
                  {post.status === 'pending' && ' · A person on the team reads every post before it shows up.'}
                  {post.status === 'rejected' && post.rejectReason ? ` · ${post.rejectReason}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {post.status === 'approved' && (
                  <Link to={`/events/${post.id}`} className="inline-flex min-h-11 items-center px-2 text-body-sm font-semibold text-ink underline underline-offset-4">
                    View
                  </Link>
                )}
                {(post.status === 'pending' || post.status === 'rejected') && (
                  <button type="button" onClick={() => void withdraw(post)} className="min-h-11 px-2 text-body-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
                    {post.status === 'pending' ? 'Take it back' : 'Remove'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-body-sm text-muted">{pluralise(posts.length, 'post')} sent from this device or account.</p>
    </section>
  )
}
