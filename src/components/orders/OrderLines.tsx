import type { OrderLineView } from '@shared/types'
import { Price } from '../ui/Price'

/** Read-only lines of a placed order: quantity, name, choices, note, price. */
export function OrderLines({ lines }: { lines: OrderLineView[] }) {
  return (
    <ul className="divide-y divide-line">
      {lines.map((line) => (
        <li key={line.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-body font-semibold text-ink">
              <span className="tnum">{line.quantity} ×</span> {line.name}
            </p>
            {line.modifiers.length > 0 && <p className="text-body-sm text-muted">{line.modifiers.join(' · ')}</p>}
            {line.note && <p className="text-body-sm text-muted">Note: {line.note}</p>}
          </div>
          <Price fils={line.lineTotalFils} size="sm" />
        </li>
      ))}
    </ul>
  )
}
