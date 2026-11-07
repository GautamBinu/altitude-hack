import { Link } from 'react-router'
import { cx } from '../../lib/cx'
import { useCart } from '../../state/cart'
import { Price } from '../ui/Price'

/** On phones: the order so far, one tap from checkout, above the tab bar. */
export function CartBar() {
  const { count, totalFils } = useCart()
  if (count === 0) return null
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 px-3 pb-3 md:bottom-0 md:left-22 lg:hidden">
      <Link
        to="/checkout"
        className={cx(
          'flex min-h-14 animate-rise items-center justify-between gap-4 rounded-lg bg-accent px-5 text-on-accent shadow-float',
          'transition-[filter] hover:brightness-110',
        )}
      >
        <span className="text-title font-semibold">
          View order <span className="font-normal tnum">({count})</span>
        </span>
        <Price fils={totalFils} size="md" className="[&_span:last-child]:text-on-accent" />
      </Link>
    </div>
  )
}
