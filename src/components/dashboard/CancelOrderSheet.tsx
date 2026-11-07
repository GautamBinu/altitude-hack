import { formatAedNumber } from '@shared/money'
import type { StaffOrderView } from '@shared/types'
import { useState } from 'react'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { ChoiceGroup } from '../ui/Fields'
import { Sheet } from '../ui/Sheet'
import { Switch, TextInput, useSaver } from './forms'

const REASONS = ['The customer changed their mind', 'We are out of an ingredient', 'The order was wrong', 'It was a duplicate', 'Something else']

/** Cancelling asks for a reason, which the customer sees, and offers a refund when a card was charged. */
export function CancelOrderSheet({ order, onClose, onDone }: { order: StaffOrderView; onClose: () => void; onDone: () => void }) {
  const saver = useSaver()
  const [reason, setReason] = useState(REASONS[0])
  const [other, setOther] = useState('')
  const canRefund = order.paymentStatus === 'paid' && order.paymentMethod === 'card'
  const [refund, setRefund] = useState(canRefund)
  const finalReason = reason === 'Something else' ? other.trim() : reason

  return (
    <Sheet open onClose={onClose} title={`Cancel order #${order.number}`}>
      <div className="grid gap-5 pb-4">
        <p className="text-body text-muted">
          {order.customerName}'s order will stop and leave the queue. They will see the reason below.
        </p>
        <ChoiceGroup legend="Reason" type="radio" name="cancel-reason" layout="stack" value={[reason]} onChange={([v]) => setReason(String(v))} choices={REASONS.map((r) => ({ value: r, label: r }))} />
        {reason === 'Something else' && <TextInput label="Tell the customer why" value={other} onChange={setOther} maxLength={140} />}
        {canRefund && (
          <div className="rounded-md border border-line p-3">
            <Switch checked={refund} onChange={setRefund} label="Refund the card" onText={`Refund AED ${formatAedNumber(order.totalFils)} to the card`} offText="Do not refund" />
          </div>
        )}
        {order.rewardPoints > 0 && <p className="text-body-sm text-muted tnum">The {order.rewardPoints.toLocaleString('en-US')} reward points they spent go back to them.</p>}
        {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="danger"
            size="xl"
            busy={saver.busy}
            disabled={!finalReason}
            onClick={async () => {
              const ok = await saver.run(() => api(`/dashboard/orders/${order.id}/cancel`, { body: { reason: finalReason, refund: canRefund && refund } }).then(() => undefined))
              if (ok) onDone()
            }}
          >
            Cancel this order
          </Button>
          <Button variant="secondary" size="xl" onClick={onClose}>
            Keep it
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
