import type { MenuItem, MoodPick } from '@shared/types'
import { cx } from '../../lib/cx'
import { selectionsWithTemperature, type Selections } from '../../lib/pricing'
import { useCart } from '../../state/cart'
import { ItemImage, useItemPhoto } from '../menu/ItemImage'
import { Button } from '../ui/Button'
import { Price } from '../ui/Price'
import { useToast } from '../ui/Toast'

interface CardProps {
  item: MenuItem
  pick: MoodPick
  lead: boolean
  onCustomise: (item: MenuItem, selections: Selections) => void
}

const TEMPERATURE_LABEL = { hot: 'Hot', iced: 'Iced' } as const

/** A large photo, the name and price, the one-line reason, and two ways to order it. */
function MoodCard({ item, pick, lead, onCustomise }: CardProps) {
  const cart = useCart()
  const toast = useToast()
  const { showPhoto, onError } = useItemPhoto(item)
  const selections = selectionsWithTemperature(item, pick.temperature)
  const temperature = pick.temperature ? TEMPERATURE_LABEL[pick.temperature] : null

  const add = () => {
    cart.add(item, selections, '', 1)
    toast.show(`${temperature ? `${temperature} ` : ''}${item.name} added to your order.`)
  }

  return (
    <article
      aria-labelledby={`mood-${item.id}`}
      className={cx('flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface', lead && 'lg:flex-row')}
    >
      <ItemImage
        item={item}
        showPhoto={showPhoto}
        onPhotoError={onError}
        className={cx('w-full shrink-0', lead ? 'aspect-[4/3] lg:aspect-auto lg:min-h-64 lg:w-1/2' : 'aspect-[16/9] sm:aspect-[16/8]')}
      />
      <div className={cx('flex flex-col gap-3 p-4 md:p-5', lead && 'lg:w-1/2 lg:justify-center lg:p-8')}>
        <div className="flex items-start justify-between gap-4">
          <h3 id={`mood-${item.id}`} className={cx('font-display font-semibold leading-tight text-ink', lead ? 'text-display-lg' : 'text-headline')}>
            {item.name}
          </h3>
          <Price fils={item.priceFils} size={lead ? 'lg' : 'md'} className="shrink-0" />
        </div>
        <p className={cx('text-ink', lead ? 'text-title' : 'text-body')}>{pick.reason}</p>
        {temperature && <p className="text-body-sm text-muted">Served {temperature.toLowerCase()}.</p>}
        {item.soldOut ? (
          <p className="text-body font-semibold text-muted">Sold out for now</p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-2">
            <Button size="md" onClick={add}>
              Add to order
            </Button>
            {item.groups.length > 0 && (
              <Button size="md" variant="secondary" onClick={() => onCustomise(item, selections)}>
                Choose options
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

interface PicksProps {
  picks: MoodPick[]
  itemsById: Map<number, MenuItem>
  onCustomise: (item: MenuItem, selections: Selections) => void
}

/** The three picks. The first is the strongest match, so it is larger. */
export function MoodPicks({ picks, itemsById, onCustomise }: PicksProps) {
  // The menu can change between the answer and now. Skip anything that has gone from it.
  const list = picks.flatMap((pick) => {
    const item = itemsById.get(pick.itemId)
    return item ? [{ pick, item }] : []
  })
  return (
    <ol className="grid gap-4 md:grid-cols-2">
      {list.map(({ pick, item }, i) => (
        <li key={item.id} className={cx('flex flex-col', i === 0 && 'md:col-span-2')}>
          <MoodCard item={item} pick={pick} lead={i === 0} onCustomise={onCustomise} />
        </li>
      ))}
    </ol>
  )
}
