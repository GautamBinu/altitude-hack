import { Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, errorMessage } from '../../lib/api'
import { cx } from '../../lib/cx'
import { useToast } from '../ui/Toast'

/** Adds or removes a menu item from the signed-in customer's favourites. */
export function FavouriteToggle({ itemId, name }: { itemId: number; name: string }) {
  const toast = useToast()
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<{ itemIds: number[] }>('/me/favourites')
      .then((r) => !cancelled && setOn(r.itemIds.includes(itemId)))
      .catch(() => !cancelled && setOn(false))
    return () => {
      cancelled = true
    }
  }, [itemId])

  const toggle = async () => {
    if (on === null || busy) return
    setBusy(true)
    try {
      await api(`/me/favourites/items/${itemId}`, { method: on ? 'DELETE' : 'PUT', body: {} })
      setOn(!on)
      toast.show(on ? `${name} removed from your favourites.` : `${name} saved to your favourites.`)
    } catch (e) {
      toast.show(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      aria-pressed={on === true}
      disabled={on === null}
      onClick={() => void toggle()}
      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-control px-3 text-body-sm font-semibold text-ink transition-colors hover:bg-raised disabled:text-muted"
    >
      <Heart size={18} strokeWidth={1.75} aria-hidden="true" className={cx(on && 'fill-current text-accent')} />
      {on ? 'In your favourites' : 'Add to favourites'}
    </button>
  )
}
