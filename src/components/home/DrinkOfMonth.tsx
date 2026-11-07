import type { HomeDrinkOfMonth, MenuItem } from '@shared/types'
import { Button } from '../ui/Button'
import { Price } from '../ui/Price'
import { Mountains } from '../ui/Art'

function untilLabel(iso: string | null): string | null {
  if (!iso) return null
  return `Here until ${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

interface Props {
  promo: HomeDrinkOfMonth
  item: MenuItem | null
  onOrder: (item: MenuItem) => void
}

/** The Drink of the Month, set by marketing in the dashboard. A big headline over a quiet ridge, and one button. */
export function DrinkOfMonth({ promo, item, onOrder }: Props) {
  const until = untilLabel(promo.endsAt)
  const photo = promo.imageUrl ?? item?.imageUrl ?? null
  return (
    <section aria-labelledby="dotm-heading" className="relative overflow-hidden rounded-lg border border-line bg-surface">
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="relative z-10 flex flex-col p-6 md:p-8">
          <h2 className="text-headline font-semibold text-muted">Drink of the Month</h2>
          <p id="dotm-heading" className="mt-2 font-display text-display-lg font-bold leading-none">
            {promo.headline}
          </p>
          {promo.copy && <p className="mt-3 max-w-sm text-body text-ink">{promo.copy}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            {item && !item.soldOut && (
              <Button size="xl" onClick={() => onOrder(item)}>
                Order it
              </Button>
            )}
            {item?.soldOut && <p className="text-body font-semibold text-muted">Sold out for now</p>}
            {item && <Price fils={item.priceFils} size="lg" />}
          </div>
          {until && <p className="mt-4 text-body-sm text-muted">{until}</p>}
        </div>
        <div className="relative min-h-40 bg-raised md:min-h-full">
          {photo ? (
            <img src={photo} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="absolute inset-x-0 bottom-0 h-full">
              <Mountains />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
