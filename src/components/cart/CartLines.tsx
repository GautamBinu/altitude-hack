import { TriangleAlert } from 'lucide-react'
import { useCart } from '../../state/cart'
import { Stepper } from '../ui/Fields'
import { Price } from '../ui/Price'

/** The lines of the current order, with quantity controls. Used in the menu's cart panel and at checkout. */
export function CartLines() {
  const { lines, setQuantity, remove } = useCart()
  return (
    <ul className="divide-y divide-line">
      {lines.map((line) => {
        const name = line.name
        return (
          <li key={line.key} className="grid gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-title font-semibold leading-snug text-ink">{name}</p>
                {line.modifiers.length > 0 && <p className="text-body-sm text-muted">{line.modifiers.join(' · ')}</p>}
                {line.note && <p className="text-body-sm text-muted">Note: {line.note}</p>}
              </div>
              {!line.problem && <Price fils={line.lineTotalFils} size="md" />}
            </div>
            {line.problem ? (
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-body-sm text-danger">
                  <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
                  {line.problem === 'sold_out'
                    ? `${name} just sold out.`
                    : line.problem === 'unavailable'
                      ? `${name} can't be made right now. Something in it is off the list.`
                      : `${name} is no longer on the menu.`}
                </p>
                <button type="button" onClick={() => remove(line.key)} className="min-h-11 px-2 text-body-sm font-semibold text-ink underline underline-offset-4">
                  Remove
                </button>
              </div>
            ) : (
              <Stepper
                value={line.quantity}
                onChange={(q) => setQuantity(line.key, q)}
                onRemove={() => remove(line.key)}
                label={name}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}
