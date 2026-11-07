import { POST_LIMITS, type PostKind, type SubmitPostInput, type SubmitPostResult } from '@shared/events'
import { ImagePlus } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Markdown } from '../../components/events/Markdown'
import { Cover } from '../../components/events/parts'
import { Button, LinkButton } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/Chip'
import { ChoiceGroup, TextField, inputClass } from '../../components/ui/Fields'
import { api, errorMessage } from '../../lib/api'
import { cx } from '../../lib/cx'
import { rememberPost } from '../../lib/myPosts'
import { resizeToDataUrl } from '../../lib/image'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useSession } from '../../state/session'

const todayLocal = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function SubmitEventPage() {
  useDocumentTitle('Share an event or post')
  const { user } = useSession()
  const [kind, setKind] = useState<PostKind>('event')
  const [title, setTitle] = useState('')
  const [club, setClub] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [place, setPlace] = useState('')
  const [body, setBody] = useState('')
  const [preview, setPreview] = useState(false)
  const [cover, setCover] = useState<string | null>(null)
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<SubmitPostResult | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const bodyId = useId()
  const dateId = useId()
  const timeId = useId()

  const ready =
    title.trim().length >= 3 &&
    club.trim().length >= 2 &&
    body.trim().length >= 10 &&
    (kind === 'post' || (date !== '' && time !== '')) &&
    (!!user || name.trim().length >= 2)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    const input: SubmitPostInput = {
      kind,
      title,
      club,
      body,
      date: kind === 'event' ? date : undefined,
      time: kind === 'event' ? time : undefined,
      place: kind === 'event' ? place : undefined,
      coverImage: cover,
      authorName: user ? undefined : name,
      website,
    }
    try {
      const result = await api<SubmitPostResult>('/events', { body: input })
      rememberPost(result.post.id, result.token)
      setSent(result)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-display-lg font-bold">Thanks. It's with the team.</h1>
        <div className="mt-6 rounded-lg border border-line bg-surface p-5">
          <p className="flex flex-wrap items-center gap-2 text-title font-semibold">
            {sent.post.title}
            <StatusChip>Pending review</StatusChip>
          </p>
          <p className="mt-2 text-body text-muted">
            A person at Altitude reads every post before anyone else can see it. You can check on it any time under Your posts on the events page
            {user ? '.' : ', on this device.'} If it isn't right, you'll see why there.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton to="/events" size="lg">
            Back to events
          </LinkButton>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setSent(null)
              setTitle('')
              setBody('')
              setDate('')
              setTime('')
              setPlace('')
              setCover(null)
              setPreview(false)
            }}
          >
            Share another
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <Link to="/events" className="inline-flex min-h-11 items-center text-body-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
        All events and clubs
      </Link>
      <h1 className="text-display-lg font-bold">Share an event or post</h1>
      <p className="mt-2 text-body text-muted">
        Anyone can send one. A person at Altitude reads it before it goes public, and you can see where it stands afterwards.
      </p>

      <form onSubmit={submit} className="mt-8 grid gap-6" noValidate>
        <ChoiceGroup
          legend="What are you sharing?"
          type="radio"
          name="kind"
          layout="split"
          value={[kind]}
          onChange={([v]) => setKind(v === 'post' ? 'post' : 'event')}
          choices={[
            { value: 'event', label: 'An event' },
            { value: 'post', label: 'A post or blog' },
          ]}
        />

        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={POST_LIMITS.title} autoComplete="off" />
        <TextField
          label="Club or community"
          value={club}
          onChange={(e) => setClub(e.target.value)}
          maxLength={POST_LIMITS.club}
          autoComplete="off"
          helper="Who is this from? For example Photo Walk Collective."
        />

        {kind === 'event' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={dateId} className="mb-1.5 block text-body-sm font-semibold text-ink">
                  Date
                </label>
                <input id={dateId} type="date" min={todayLocal()} value={date} onChange={(e) => setDate(e.target.value)} className={cx(inputClass, 'border-control')} />
              </div>
              <div>
                <label htmlFor={timeId} className="mb-1.5 block text-body-sm font-semibold text-ink">
                  Start time
                </label>
                <input id={timeId} type="time" value={time} onChange={(e) => setTime(e.target.value)} className={cx(inputClass, 'border-control')} />
              </div>
            </div>
            <TextField label="Place" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={POST_LIMITS.place} autoComplete="off" helper="Optional. Where should people go?" />
          </>
        )}

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor={bodyId} className="text-body-sm font-semibold text-ink">
              Details
            </label>
            <button
              type="button"
              onClick={() => setPreview((v) => !v)}
              aria-pressed={preview}
              className="min-h-11 px-2 text-body-sm font-semibold text-ink underline underline-offset-4"
            >
              {preview ? 'Keep writing' : 'Preview'}
            </button>
          </div>
          {preview ? (
            <div className="min-h-40 rounded-md border border-control bg-raised px-3.5 py-3" aria-live="polite">
              {body.trim() ? <Markdown text={body} /> : <p className="text-body text-muted">Nothing to preview yet.</p>}
            </div>
          ) : (
            <textarea
              id={bodyId}
              rows={8}
              maxLength={POST_LIMITS.body}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={cx(inputClass, 'border-control leading-snug')}
            />
          )}
          <p className="mt-1.5 text-body-sm text-muted">
            Plain text is fine. You can also use **bold**, - lists and [links](https://example.com).
            <span className="tnum"> {body.length.toLocaleString('en-US')} of {POST_LIMITS.body.toLocaleString('en-US')}.</span>
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-body-sm font-semibold text-ink">Cover picture</p>
          <div className="flex items-center gap-4">
            <Cover src={cover} seed={1} className="size-20 shrink-0 rounded-lg border border-line" />
            <div>
              <input
                ref={file}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Choose a cover picture"
                onChange={async (e) => {
                  const picked = e.target.files?.[0]
                  e.target.value = ''
                  if (!picked) return
                  setCoverBusy(true)
                  setCoverError(null)
                  try {
                    setCover(await resizeToDataUrl(picked, 1200, 900_000))
                  } catch (err) {
                    setCoverError(errorMessage(err))
                  } finally {
                    setCoverBusy(false)
                  }
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="md" busy={coverBusy} onClick={() => file.current?.click()}>
                  <ImagePlus size={16} strokeWidth={1.75} aria-hidden="true" />
                  {cover ? 'Change picture' : 'Add a picture'}
                </Button>
                {cover && (
                  <Button type="button" variant="tertiary" size="md" onClick={() => setCover(null)}>
                    Remove
                  </Button>
                )}
              </div>
              <p className={cx('mt-1.5 text-body-sm', coverError ? 'text-danger' : 'text-muted')}>{coverError ?? 'Optional. JPEG, PNG or WebP. It is shrunk before it is sent.'}</p>
            </div>
          </div>
        </div>

        {user ? (
          <p className="text-body-sm text-muted">Posting as {user.firstName}.</p>
        ) : (
          <TextField
            label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={POST_LIMITS.name}
            autoComplete="given-name"
            helper="So the team knows who sent it. It is not shown to the public."
          />
        )}

        {/* A trap for scripts. Real people never see it and never fill it. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Leave this empty
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-body text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" size="xl" busy={busy} disabled={!ready}>
            Send for review
          </Button>
          {!ready && <p className="text-body-sm text-muted">Fill in the title, club, details{kind === 'event' ? ', date and time' : ''}{user ? '' : ' and your name'} to send it.</p>}
        </div>
      </form>
    </div>
  )
}
