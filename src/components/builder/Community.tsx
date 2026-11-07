import { describeCreation, type CommunityCreation } from '@shared/builder'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../lib/api'
import { useLiveRefresh } from '../../lib/liveEvents'
import { useBuilder } from '../../state/builder'
import { useCart } from '../../state/cart'
import { Button } from '../ui/Button'
import { StatusChip } from '../ui/Chip'
import { Price } from '../ui/Price'
import { useToast } from '../ui/Toast'

/** Creations other students shared and the team approved. Refreshes when the team approves or removes one. */
export function useCommunity(): CommunityCreation[] {
  const [creations, setCreations] = useState<CommunityCreation[]>([])
  const load = useCallback(() => {
    api<{ creations: CommunityCreation[] }>('/builder/community')
      .then((r) => setCreations(r.creations))
      .catch(() => {})
  }, [])
  useLiveRefresh(load)
  useEffect(load, [load])
  return creations
}

/** A short list of community coffees. Each can be ordered as it is, or opened in the builder and changed. */
export function CommunityBoard({ creations, heading, limit }: { creations: CommunityCreation[]; heading: string; limit?: number }) {
  const cart = useCart()
  const toast = useToast()
  const { data } = useBuilder()
  const shown = limit ? creations.slice(0, limit) : creations
  if (shown.length === 0) return null

  return (
    <section aria-labelledby="community-heading">
      <h2 id="community-heading" className="text-headline font-semibold">
        {heading}
      </h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {shown.map((c) => {
          const described = data ? describeCreation(c.config, data) : null
          const price = described?.ok ? described.unitPriceFils : c.priceFils
          const canOrder = !data || described?.ok
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4">
              <div className="min-w-0 flex-1 basis-56">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-title font-semibold leading-snug">
                  {c.name}
                  {c.isSample && <StatusChip>Sample</StatusChip>}
                </p>
                <p className="text-body-sm text-muted">by {c.authorFirstName}</p>
                <p className="mt-1 text-body-sm text-muted">{(described?.ok ? described.modifiers : c.modifiers).join(' · ')}</p>
              </div>
              <div className="flex items-center gap-3">
                <Price fils={price} size="md" />
                <Link
                  to={`/build?community=${c.id}`}
                  className="inline-flex min-h-11 items-center rounded-md px-2 text-body-sm font-semibold text-ink underline underline-offset-4 hover:bg-raised"
                >
                  Change it
                </Link>
                <Button
                  size="md"
                  disabled={!canOrder}
                  onClick={() => {
                    cart.addCreation({ ...c.config, name: c.name }, 1)
                    toast.show(`${c.name} added to your order.`)
                  }}
                >
                  Add
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
