import type { MenuItem } from '@shared/types'
import { useMemo, useState } from 'react'
import { defaultSelections, selectionsComplete, unitPriceFils, type Selections } from '../../lib/pricing'
import { useCart } from '../../state/cart'
import { useSession } from '../../state/session'
import { FavouriteToggle } from './FavouriteToggle'
import { Button } from '../ui/Button'
import { ChoiceGroup, inputClass, Stepper, type Choice } from '../ui/Fields'
import { Price, PriceDelta } from '../ui/Price'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/Toast'
import { ItemImage, useItemPhoto } from './ItemImage'
import { cx } from '../../lib/cx'

interface ItemSheetProps {
  item: MenuItem | null
  onClose: () => void
  /** Choices to start from instead of the defaults, for example the temperature the customer asked for. */
  initialSelections?: Selections
}

/** Temperature, milk, extras, a note to the barista and a running price, with one clear button. */
export function ItemSheet({ item, onClose, initialSelections }: ItemSheetProps) {
  return (
    <Sheet open={!!item} onClose={onClose} title={item?.name ?? ''}>
      {item && <SheetBody key={item.id} item={item} onClose={onClose} initialSelections={initialSelections} />}
    </Sheet>
  )
}

/** The sheet's footer lives inside the body so it can read the selections. */
function SheetBody({ item, onClose, initialSelections }: { item: MenuItem; onClose: () => void; initialSelections?: Selections }) {
  const cart = useCart()
  const toast = useToast()
  const { user } = useSession()
  const [selections, setSelections] = useState<Selections>(() => initialSelections ?? defaultSelections(item.groups))
  const [note, setNote] = useState('')
  const [quantity, setQuantity] = useState(1)
  const { showPhoto, onError } = useItemPhoto(item)

  const unit = useMemo(() => unitPriceFils(item, selections), [item, selections])
  const complete = selectionsComplete(item.groups, selections)

  const add = () => {
    cart.add(item, selections, note, quantity)
    toast.show(`${quantity > 1 ? `${quantity} × ` : ''}${item.name} added to your order.`)
    onClose()
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="grid gap-5">
        {showPhoto && (
          <ItemImage item={item} showPhoto onPhotoError={onError} className="aspect-[16/9] w-full rounded-lg" />
        )}
        <p className="text-body text-muted">{item.description}</p>
        {user && <FavouriteToggle itemId={item.id} name={item.name} />}

        {item.groups.map((group) => {
          const choices: Choice[] = group.options.map((option) => ({
            value: option.id,
            label: option.name,
            hint:
              option.priceDeltaFils !== 0 ? (
                <PriceDelta fils={option.priceDeltaFils} />
              ) : group.kind === 'multi' ? (
                'Included'
              ) : undefined,
          }))
          return (
            <ChoiceGroup
              key={group.id}
              legend={group.name}
              note={group.required ? undefined : 'Optional'}
              type={group.kind === 'single' ? 'radio' : 'checkbox'}
              name={`group-${group.id}`}
              choices={choices}
              value={selections[String(group.id)] ?? []}
              onChange={(next) => setSelections((s) => ({ ...s, [String(group.id)]: next.map(Number) }))}
            />
          )
        })}

        <div>
          <label htmlFor="barista-note" className="mb-1.5 flex items-baseline justify-between text-body-sm font-semibold text-ink">
            <span>Note for the barista</span>
            <span className="font-normal text-muted">Optional</span>
          </label>
          <textarea
            id="barista-note"
            rows={2}
            maxLength={140}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Extra hot, no sugar, oat foam"
            className={cx(inputClass, 'border-control resize-none')}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-body-sm font-semibold text-ink">Quantity</span>
          <Stepper value={quantity} onChange={setQuantity} label={item.name} />
        </div>
      </div>

      <div className="sticky -bottom-4 -mx-4 mt-6 border-t border-line bg-surface px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:-mx-6 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <Price fils={unit * quantity} size="lg" />
          <Button size="xl" onClick={add} disabled={!complete} className="min-w-44">
            Add to order
          </Button>
        </div>
        {!complete && <p className="mt-2 text-body-sm text-muted">Choose an option above to continue.</p>}
      </div>
    </div>
  )
}
