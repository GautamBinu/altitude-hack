import type { SavedCreation } from '@shared/builder'
import type { MenuItem } from '@shared/types'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api, errorMessage } from '../../lib/api'
import { defaultSelections } from '../../lib/pricing'
import { useCart } from '../../state/cart'
import { useMenu } from '../../state/menu'
import { Button } from '../ui/Button'
import { StatusChip } from '../ui/Chip'
import { Price } from '../ui/Price'
import { useToast } from '../ui/Toast'

const STATUS = { pending: 'Waiting for review', approved: 'On the community board', rejected: 'Not approved' } as const

interface Favourites {
  itemIds: number[]
  creations: SavedCreation[]
}

/** Saved drinks and the coffees the customer built, each one tap from the cart. */
export function FavouritesSection() {
  const { itemsById } = useMenu()
  const cart = useCart()
  const toast = useToast()
  const [data, setData] = useState<Favourites | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const load = useCallback(() => {
    api<Favourites>('/me/favourites')
      .then((r) => {
        setData(r)
        setFailed(null)
      })
      .catch((e: unknown) => setFailed(errorMessage(e)))
  }, [])
  useEffect(load, [load])

  const items = (data?.itemIds ?? []).map((id) => itemsById.get(id)).filter((i): i is MenuItem => !!i)
  const creations = data?.creations ?? []

  const removeItem = async (item: MenuItem) => {
    try {
      await api(`/me/favourites/items/${item.id}`, { method: 'DELETE', body: {} })
      toast.show(`${item.name} removed from your favourites.`)
      load()
    } catch (e) {
      toast.show(errorMessage(e), 'error')
    }
  }
  const removeCreation = async (c: SavedCreation) => {
    try {
      await api(`/me/creations/${c.id}`, { method: 'DELETE' })
      toast.show(`${c.name} removed.`)
      load()
    } catch (e) {
      toast.show(errorMessage(e), 'error')
    }
  }

  return (
    <section aria-labelledby="favourites-heading" className="mt-8">
      <h2 id="favourites-heading" className="mb-2 text-headline font-semibold">
        Favourites
      </h2>
      {failed && <p role="alert" className="text-body-sm text-danger">{failed}</p>}
      {data && items.length === 0 && creations.length === 0 && (
        <p className="text-body text-muted">
          Nothing saved yet. Tap Add to favourites on a drink, or{' '}
          <Link to="/build" className="font-semibold text-ink underline underline-offset-4">
            build your own coffee
          </Link>{' '}
          and save it.
        </p>
      )}

      {(items.length > 0 || creations.length > 0) && (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((item) => (
            <li key={`i${item.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-title font-semibold leading-snug">{item.name}</p>
                <p className="text-body-sm text-muted">{item.soldOut ? 'Sold out for now' : item.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Price fils={item.priceFils} size="md" />
                <Button
                  size="md"
                  disabled={item.soldOut}
                  onClick={() => {
                    cart.add(item, defaultSelections(item.groups), '', 1)
                    toast.show(`${item.name} added to your order.`)
                  }}
                >
                  Add
                </Button>
                <button type="button" onClick={() => void removeItem(item)} className="min-h-11 px-2 text-body-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
                  Remove
                </button>
              </div>
            </li>
          ))}
          {creations.map((c) => (
            <li key={`c${c.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1 basis-48">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-title font-semibold leading-snug">
                  {c.name}
                  {c.submitStatus !== 'none' && <StatusChip tone={c.submitStatus === 'approved' ? 'success' : c.submitStatus === 'rejected' ? 'warning' : 'neutral'}>{STATUS[c.submitStatus]}</StatusChip>}
                </p>
                <p className="text-body-sm text-muted">{c.priceFils == null ? 'Something in this recipe is no longer on offer.' : c.modifiers.join(' · ')}</p>
                {c.submitStatus === 'rejected' && c.rejectReason && <p className="text-body-sm text-muted">Reason: {c.rejectReason}</p>}
              </div>
              <div className="flex items-center gap-2">
                {c.priceFils != null && <Price fils={c.priceFils} size="md" />}
                <Button
                  size="md"
                  disabled={c.priceFils == null}
                  onClick={() => {
                    cart.addCreation({ ...c.config, name: c.name }, 1)
                    toast.show(`${c.name} added to your order.`)
                  }}
                >
                  Add
                </Button>
                <Link to={`/build?creation=${c.id}`} className="inline-flex min-h-11 items-center px-2 text-body-sm font-semibold text-ink underline underline-offset-4">
                  Change
                </Link>
                <button type="button" onClick={() => void removeCreation(c)} className="min-h-11 px-2 text-body-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
