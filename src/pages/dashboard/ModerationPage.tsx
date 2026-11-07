import { useCallback, useEffect, useState } from 'react'
import { Price } from '../../components/ui/Price'
import { ChoiceGroup } from '../../components/ui/Fields'
import { LoadingLine } from '../../components/ui/Art'
import { Button } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/Chip'
import { Sheet } from '../../components/ui/Sheet'
import { ErrorState } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import { TextInput, useSaver } from '../../components/dashboard/forms'
import { api, ApiError, errorMessage } from '../../lib/api'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

interface Creation {
  id: number
  name: string
  authorName: string
  priceFils: number | null
  modifiers: string[]
  status: 'none' | 'pending' | 'approved' | 'rejected'
  rejectReason: string | null
  submittedAt: string | null
  decidedAt: string | null
  isSample: boolean
}
interface Queue {
  pending: Creation[]
  decided: Creation[]
}

const REASONS = ["The name isn't suitable", 'That recipe is a copy of another', "It isn't something we can make", 'Something else']

function ago(iso: string | null): string {
  if (!iso) return ''
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

/** Say no, and say why. The reason is shown to the person who shared it. */
function RejectSheet({ creation, onClose, onDone }: { creation: Creation; onClose: () => void; onDone: () => void }) {
  const saver = useSaver()
  const [reason, setReason] = useState(REASONS[0])
  const [other, setOther] = useState('')
  const text = reason === 'Something else' ? other.trim() : reason
  return (
    <Sheet open onClose={onClose} title={`Turn down ${creation.name}`}>
      <div className="grid gap-5 pb-4">
        <p className="text-body text-muted">{creation.authorName} will see the reason next to their saved coffee.</p>
        <ChoiceGroup legend="Reason" type="radio" name="reject-reason" layout="stack" value={[reason]} onChange={([v]) => setReason(String(v))} choices={REASONS.map((r) => ({ value: r, label: r }))} />
        {reason === 'Something else' && <TextInput label="Tell them why" value={other} onChange={setOther} maxLength={160} />}
        {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="danger"
            size="xl"
            busy={saver.busy}
            disabled={!text}
            onClick={async () => {
              const ok = await saver.run(() => api(`/dashboard/creations/${creation.id}/reject`, { body: { reason: text } }).then(() => undefined))
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

function PendingCard({ creation, onChanged }: { creation: Creation; onChanged: () => void }) {
  const toast = useToast()
  const saver = useSaver()
  const [name, setName] = useState(creation.name)
  const [rejecting, setRejecting] = useState(false)
  return (
    <li className="grid gap-4 rounded-lg border border-line bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-body-sm text-muted">
            by {creation.authorName} · {ago(creation.submittedAt)}
            {creation.isSample && <StatusChip>Sample</StatusChip>}
          </p>
          <p className="mt-1 text-body text-ink">{creation.modifiers.join(' · ') || 'This recipe uses something that is no longer on offer.'}</p>
        </div>
        {creation.priceFils != null && <Price fils={creation.priceFils} size="md" />}
      </div>
      <TextInput label="Name on the board" value={name} onChange={setName} maxLength={40} helper="Fix the name here before you approve it." />
      {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          busy={saver.busy}
          disabled={creation.priceFils == null || name.trim() === ''}
          onClick={async () => {
            const ok = await saver.run(() => api(`/dashboard/creations/${creation.id}/approve`, { body: { name } }).then(() => undefined))
            if (ok) {
              toast.show(`${name.trim()} is on the board.`)
              onChanged()
            }
          }}
        >
          Approve
        </Button>
        <Button variant="danger" size="lg" onClick={() => setRejecting(true)}>
          Turn down
        </Button>
      </div>
      {rejecting && (
        <RejectSheet
          creation={creation}
          onClose={() => setRejecting(false)}
          onDone={() => {
            setRejecting(false)
            toast.show(`${creation.name} was turned down.`)
            onChanged()
          }}
        />
      )}
    </li>
  )
}

function DecidedRow({ creation, onChanged }: { creation: Creation; onChanged: () => void }) {
  const toast = useToast()
  const saver = useSaver()
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="flex flex-wrap items-center gap-2 text-title font-semibold leading-snug">
          {creation.name}
          <StatusChip tone={creation.status === 'approved' ? 'success' : 'warning'}>{creation.status === 'approved' ? 'On the board' : 'Turned down'}</StatusChip>
          {creation.isSample && <StatusChip>Sample</StatusChip>}
        </p>
        <p className="text-body-sm text-muted">
          by {creation.authorName} · {ago(creation.decidedAt)}
          {creation.status === 'rejected' && creation.rejectReason ? ` · ${creation.rejectReason}` : ''}
        </p>
        {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
      </div>
      {creation.status === 'approved' && (
        <Button
          variant="secondary"
          size="md"
          busy={saver.busy}
          onClick={async () => {
            const ok = await saver.run(() => api(`/dashboard/creations/${creation.id}/unpublish`, { body: {} }).then(() => undefined))
            if (ok) {
              toast.show(`${creation.name} is off the board.`)
              onChanged()
            }
          }}
        >
          Take off the board
        </Button>
      )}
    </li>
  )
}

/** Community coffees waiting for a yes or no, and the ones already decided. */
export function ModerationPage() {
  useDocumentTitle('Review')
  const [queue, setQueue] = useState<Queue | null>(null)
  const [error, setError] = useState<{ message: string; offline: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      setQueue(await api<Queue>('/dashboard/creations'))
      setError(null)
    } catch (e) {
      setError({ message: errorMessage(e), offline: e instanceof ApiError && e.isOffline })
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 20_000)
    return () => window.clearInterval(id)
  }, [load])

  return (
    <div className="max-w-3xl">
      <h1 className="text-display-lg font-bold">Review</h1>
      <p className="mt-1 text-body text-muted">Coffees customers have shared. Approve to put one on the board, or turn it down with a reason.</p>

      {error && !queue && <ErrorState className="mt-6" title="The list didn't load" message={error.message} offline={error.offline} onRetry={() => void load()} />}
      {!queue && !error && (
        <div role="status" className="mt-6">
          <LoadingLine label="Loading" />
        </div>
      )}

      {queue && (
        <>
          <section aria-labelledby="pending-heading" className="mt-8">
            <h2 id="pending-heading" className="mb-3 flex items-baseline justify-between text-headline font-semibold">
              Waiting for review
              <span className="text-title text-muted tnum">{queue.pending.length}</span>
            </h2>
            {queue.pending.length === 0 ? (
              <p className="rounded-lg border border-dashed border-control px-4 py-8 text-center text-body text-muted">Nothing is waiting. New shares from customers show up here.</p>
            ) : (
              <ul className="grid gap-3">
                {queue.pending.map((c) => (
                  <PendingCard key={c.id} creation={c} onChanged={() => void load()} />
                ))}
              </ul>
            )}
          </section>

          {queue.decided.length > 0 && (
            <section aria-labelledby="decided-heading" className="mt-10">
              <h2 id="decided-heading" className="mb-2 text-headline font-semibold">
                Recently decided
              </h2>
              <ul className="divide-y divide-line border-y border-line">
                {queue.decided.map((c) => (
                  <DecidedRow key={c.id} creation={c} onChanged={() => void load()} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
