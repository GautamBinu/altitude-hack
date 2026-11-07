import type { OrderLineView } from '@shared/types'
import { useNavigate } from 'react-router'
import { reorder } from '../../lib/reorder'
import { useCart } from '../../state/cart'
import { useMenu } from '../../state/menu'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'

/** Puts the same lines in the cart and goes to checkout. Items that are gone or sold out are left out, and the customer is told. */
export function ReorderButton({ lines, label = 'Order again', variant = 'secondary' }: { lines: OrderLineView[]; label?: string; variant?: 'primary' | 'secondary' }) {
  const cart = useCart()
  const { itemsById } = useMenu()
  const toast = useToast()
  const navigate = useNavigate()

  return (
    <Button
      size="md"
      variant={variant}
      onClick={() => {
        const { added, skipped } = reorder(lines, itemsById, cart)
        if (added === 0) {
          toast.show("Those items aren't available right now.", 'error')
          return
        }
        if (skipped > 0) toast.show(`${skipped} item${skipped === 1 ? ' is' : 's are'} no longer available and was left out.`)
        navigate('/checkout')
      }}
    >
      {label}
    </Button>
  )
}
