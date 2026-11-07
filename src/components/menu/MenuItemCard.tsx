import type { MenuItem } from '@shared/types'
import { formatAedNumber } from '@shared/money'
import { Plus } from 'lucide-react'
import { cx } from '../../lib/cx'
import { Price } from '../ui/Price'
import { ItemImage, useItemPhoto } from './ItemImage'

const TEMPERATURE_NOTE: Record<MenuItem['temperature'], string> = {
  hot: 'Hot',
  iced: 'Iced',
  both: 'Hot or iced',
  none: '',
}

interface MenuItemCardProps {
  item: MenuItem
  onOpen: (item: MenuItem) => void
}

/** Image on top, name, a line of description, the price bottom left and the add control bottom right. */
export function MenuItemCard({ item, onOpen }: MenuItemCardProps) {
  const { showPhoto, onError } = useItemPhoto(item)
  const temperature = TEMPERATURE_NOTE[item.temperature]

  const body = (
    <>
      <ItemImage
        item={item}
        showPhoto={showPhoto}
        onPhotoError={onError}
        nameOnFallback
        className={cx('aspect-[4/3] w-full', item.soldOut && 'opacity-70')}
      />
      <div className="flex flex-1 flex-col gap-1 p-3">
        {showPhoto && <span className="font-display text-headline font-semibold leading-tight text-ink">{item.name}</span>}
        <span className="line-clamp-2 text-body-sm text-muted">{item.description}</span>
        <span className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="flex flex-col gap-1">
            <Price fils={item.priceFils} />
            {temperature && <span className="text-body-sm text-muted">{temperature}</span>}
          </span>
          {item.soldOut ? (
            <span className="whitespace-nowrap rounded-sm border border-control px-2 py-1 text-label font-semibold uppercase text-muted">Sold out</span>
          ) : (
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-md bg-accent text-on-accent transition-[filter] group-hover:brightness-110"
            >
              <Plus size={22} strokeWidth={2} />
            </span>
          )}
        </span>
      </div>
    </>
  )

  const base = 'flex h-full w-full flex-col overflow-hidden rounded-lg border border-line bg-surface text-left'

  if (item.soldOut) {
    return (
      <div className={base} aria-label={`${item.name}, sold out`} role="group">
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={`${item.name}, ${formatAedNumber(item.priceFils)} AED. Choose options and add to your order.`}
      className={cx(base, 'group transition-colors duration-150 hover:border-control')}
    >
      {body}
    </button>
  )
}
