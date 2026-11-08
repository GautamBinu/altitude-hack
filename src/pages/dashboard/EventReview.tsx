import type { ModerationPost, ModerationQueue } from '@shared/events'
import { useState } from 'react'
import { Cover } from '../../components/events/parts'
import { Markdown } from '../../components/events/Markdown'
import { Field, ImagePicker, TextAreaInput, TextInput, useSaver } from '../../components/dashboard/forms'
import { Button } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/Chip'
import { ChoiceGroup, inputClass } from '../../components/ui/Fields'
import { Sheet } from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { api } from '../../lib/api'
import { cx } from '../../lib/cx'
import { eventWhen } from '../../lib/format'

const REASONS = ["That isn't something we can put on the board", 'It looks like a copy of another post', 'It needs more detail', 'Something else']

function ago(iso: string | null): string {
  if (!iso) return ''
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

const STATUS = {
  pending: { tone: 'neutral', text: 'Waiting' },
  approved: { tone: 'success', text: 'Public' },
  rejected: { tone: 'warning', text: 'Turned down' },
  unpublished: { tone: 'neutral', text: 'Taken down' },
} as const

function RejectSheet({ post, onClose, onDone }: { post: ModerationPost; onClose: () => void; onDone: () => void }) {
  const saver = useSaver()
  const [reason, setReason] = useState(REASONS[0])
  const [other, setOther] = useState('')
  const text = reason === 'Something else' ? other.trim() : reason
  return (
    <Sheet open onClose={onClose} title={`Turn down ${post.title}`}>
      <div className="grid gap-5 pb-4">
        <p className="text-body text-muted">{post.authorName} will see the reason under Your posts.</p>
        <ChoiceGroup legend="Reason" type="radio" name="post-reject-reason" layout="stack" value={[reason]} onChange={([v]) => setReason(String(v))} choices={REASONS.map((r) => ({ value: r, label: r }))} />
        {reason === 'Something else' && <TextInput label="Tell them why" value={other} onChange={setOther} maxLength={160} />}
        {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="danger"
            size="xl"
            busy={saver.busy}
            disabled={!text}
            onClick={async () => {
              const ok = await saver.run(() => api(`/dashboard/posts/${post.id}/reject`, { body: { reason: text } }).then(() => undefined))
              if (ok) onDone()
            }}
          >
            Turn it down
          </Button>
          <Button variant="secondary" size="xl" onClick={onClose}>
            Keep waiting
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

/** Fix the words, the date or the picture. Saving does not approve it. */
function EditSheet({ post, onClose, onDone }: { post: ModerationPost; onClose: () => void; onDone: () => void }) {
  const saver = useSaver()
  const [title, setTitle] = useState(post.title)
  const [club, setClub] = useState(post.club)
  const [date, setDate] = useState(post.date ?? '')
  const [time, setTime] = useState(post.time ?? '')
  const [place, setPlace] = useState(post.place ?? '')
  const [body, setBody] = useState(post.body)
  const [cover, setCover] = useState<string | null>(post.coverImage)
  return (
    <Sheet open onClose={onClose} title={`Edit ${post.title}`}>
      <div className="grid gap-5 pb-4">
        <TextInput label="Title" value={title} onChange={setTitle} maxLength={80} />
        <TextInput label="Club or community" value={club} onChange={setClub} maxLength={60} />
        {post.kind === 'event' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date">
                <input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} className={cx(inputClass, 'border-control')} />
              </Field>
              <Field label="Start time" helper="On the shop's clock.">
                <input type="time" aria-label="Start time" value={time} onChange={(e) => setTime(e.target.value)} className={cx(inputClass, 'border-control')} />
              </Field>
            </div>
            <TextInput label="Place" value={place} onChange={setPlace} maxLength={80} />
          </>
        )}
        <TextAreaInput label="Details" value={body} onChange={setBody} rows={9} maxLength={4000} helper="Markdown: **bold**, - lists, [links](https://...)." />
        <ImagePicker label="Cover picture" value={cover} onChange={setCover} folder="events" />
        {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
        <div className="flex flex-wrap gap-3">
          <Button
            size="xl"
            busy={saver.busy}
            onClick={async () => {
              const ok = await saver.run(() =>
                api(`/dashboard/posts/${post.id}`, {
                  method: 'PATCH',
                  body: { title, club, body, date: post.kind === 'event' ? date : undefined, time: post.kind === 'event' ? time : undefined, place: post.kind === 'event' ? place : undefined, coverImage: cover },
                }).then(() => undefined),
              )
              if (ok) onDone()
            }}
          >
            Save changes
          </Button>
          <Button variant="secondary" size="xl" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

function PostSummary({ post }: { post: ModerationPost }) {
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label font-semibold uppercase text-muted">
        {post.kind === 'event' ? 'Event' : 'Post'}
        <span aria-hidden="true">·</span>
        {post.club}
        {post.isSample && <StatusChip className="normal-case">Sample</StatusChip>}
      </p>
      <p className="mt-1 font-display text-headline font-semibold leading-tight">{post.title}</p>
      {post.startsAt && (
        <p className="mt-1 text-body font-semibold tnum">
          {eventWhen(post.startsAt)}
          {post.place ? ` · ${post.place}` : ''}
        </p>
      )}
    </>
  )
}

function PendingCard({ post, onChanged }: { post: ModerationPost; onChanged: () => void }) {
  const toast = useToast()
  const saver = useSaver()
  const [rejecting, setRejecting] = useState(false)
  const [editing, setEditing] = useState(false)
  return (
    <li className="grid gap-4 rounded-lg border border-line bg-surface p-4 md:p-5">
      <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <Cover src={post.coverImage} seed={post.id} startsAt={post.startsAt} className="aspect-[16/10] rounded-md border border-line sm:aspect-square" />
        <div className="min-w-0">
          <PostSummary post={post} />
          <p className="mt-2 text-body-sm text-muted">
            Sent by {post.authorName} ({post.signedIn ? 'signed in' : 'guest'}) · {ago(post.createdAt)}
          </p>
        </div>
      </div>
      <div className="max-h-72 overflow-auto rounded-md border border-line bg-raised p-3 md:p-4" tabIndex={0} aria-label="Preview of the details">
        <Markdown text={post.body} />
      </div>
      {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          busy={saver.busy}
          onClick={async () => {
            const ok = await saver.run(() => api(`/dashboard/posts/${post.id}/approve`, { body: {} }).then(() => undefined))
            if (ok) {
              toast.show(`${post.title} is public.`)
              onChanged()
            }
          }}
        >
          Approve
        </Button>
        <Button variant="secondary" size="lg" onClick={() => setEditing(true)}>
          Edit first
        </Button>
        <Button variant="danger" size="lg" onClick={() => setRejecting(true)}>
          Turn down
        </Button>
      </div>
      {editing && (
        <EditSheet
          post={post}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false)
            toast.show('Saved. It is still waiting for your approval.')
            onChanged()
          }}
        />
      )}
      {rejecting && (
        <RejectSheet
          post={post}
          onClose={() => setRejecting(false)}
          onDone={() => {
            setRejecting(false)
            toast.show(`${post.title} was turned down.`)
            onChanged()
          }}
        />
      )}
    </li>
  )
}

function DecidedRow({ post, onChanged }: { post: ModerationPost; onChanged: () => void }) {
  const toast = useToast()
  const saver = useSaver()
  const [editing, setEditing] = useState(false)
  const chip = STATUS[post.status]
  const act = async (path: 'unpublish' | 'publish', message: string) => {
    const ok = await saver.run(() => api(`/dashboard/posts/${post.id}/${path}`, { body: {} }).then(() => undefined))
    if (ok) {
      toast.show(message)
      onChanged()
    }
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="flex flex-wrap items-center gap-2 text-title font-semibold leading-snug">
          {post.title}
          <StatusChip tone={chip.tone}>{chip.text}</StatusChip>
          {post.isSample && <StatusChip>Sample</StatusChip>}
        </p>
        <p className="text-body-sm text-muted">
          {post.club} · {post.authorName} · {ago(post.decidedAt)}
          {post.status === 'approved' && post.interestCount > 0 ? ` · ${post.interestCount} interested` : ''}
          {post.status === 'rejected' && post.rejectReason ? ` · ${post.rejectReason}` : ''}
        </p>
        {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {post.status !== 'rejected' && (
          <Button variant="tertiary" size="md" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        {post.status === 'approved' && (
          <Button variant="secondary" size="md" busy={saver.busy} onClick={() => void act('unpublish', `${post.title} is taken down.`)}>
            Take down
          </Button>
        )}
        {post.status === 'unpublished' && (
          <Button variant="secondary" size="md" busy={saver.busy} onClick={() => void act('publish', `${post.title} is public again.`)}>
            Publish again
          </Button>
        )}
      </div>
      {editing && (
        <EditSheet
          post={post}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false)
            toast.show('Saved.')
            onChanged()
          }}
        />
      )}
    </li>
  )
}

/** Posts from clubs and communities: read them, fix them, and decide. */
export function EventReview({ queue, onChanged }: { queue: ModerationQueue; onChanged: () => void }) {
  return (
    <>
      <section aria-labelledby="posts-pending" className="mt-6">
        <h2 id="posts-pending" className="mb-3 flex items-baseline justify-between text-headline font-semibold">
          Waiting for review
          <span className="text-title text-muted tnum">{queue.pending.length}</span>
        </h2>
        {queue.pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-control px-4 py-8 text-center text-body text-muted">Nothing is waiting. Posts from the events page show up here.</p>
        ) : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {queue.pending.map((p) => (
              <PendingCard key={p.id} post={p} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </section>
      {queue.decided.length > 0 && (
        <section aria-labelledby="posts-decided" className="mt-10">
          <h2 id="posts-decided" className="mb-2 text-headline font-semibold">
            Everything else
          </h2>
          <ul className="divide-y divide-line border-y border-line xl:grid xl:grid-cols-2 xl:gap-x-12">
            {queue.decided.map((p) => (
              <DecidedRow key={p.id} post={p} onChanged={onChanged} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
