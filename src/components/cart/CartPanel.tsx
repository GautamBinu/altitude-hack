import { useCart } from '../../state/cart'
import { LinkButton } from '../ui/Button'
import { Price } from '../ui/Price'
import { CartLines } from './CartLines'

/** The order so far, beside the menu on tablet and laptop. */
export function CartPanel() {
  const { lines, count, totalFils, hasProblems } = useCart()
  return (
    <section aria-labelledby="cart-heading" className="rounded-lg border border-line bg-surface p-5">
      <h2 id="cart-heading" className="text-headline font-semibold">
        Your order
      </h2>
      {lines.length === 0 ? (
        <p className="mt-3 text-body text-muted">Nothing yet. Pick a drink from the menu and it will show up here.</p>
      ) : (
        <>
          <div className="mt-4 max-h-[50dvh] overflow-y-auto pr-1">
            <CartLines />
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
            <span className="text-title font-semibold">Total</span>
            <Price fils={totalFils} size="lg" />
          </div>
          <LinkButton to="/checkout" size="xl" block className="mt-4" aria-disabled={count === 0 || undefined}>
            Checkout
          </LinkButton>
          {hasProblems && <p className="mt-2 text-body-sm text-danger">Some items can't be ordered. Remove them to continue.</p>}
        </>
      )}
    </section>
  )
}
