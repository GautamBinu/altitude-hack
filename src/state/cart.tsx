import { cleanCreationName, creationKey, describeCreation } from '@shared/builder'
import { describeSelections } from '@shared/modifiers'
import type { CreationConfig, MenuItem, OrderLineInput } from '@shared/types'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { unitPriceFils, type Selections } from '../lib/pricing'
import { useBuilder } from './builder'
import { useMenu } from './menu'

const STORAGE_KEY = 'altitude.cart.v1'
const MAX_QUANTITY = 20

type Creation = CreationConfig & { name: string }

/** A line in the cart: a menu item with its choices, or a coffee from the builder. Never a price. */
interface StoredLine {
  key: string
  /** Null for a builder creation. */
  itemId: number | null
  quantity: number
  selections: Selections
  note: string
  creation?: Creation
}

export interface CartLine extends StoredLine {
  item: MenuItem | null
  /** Why the line cannot be ordered right now, if it cannot. */
  problem: 'missing' | 'sold_out' | 'unavailable' | null
  unitPriceFils: number
  lineTotalFils: number
  modifiers: string[]
  /** What to show as the line's name. */
  name: string
}

interface CartValue {
  lines: CartLine[]
  /** Number of drinks and snacks that can actually be ordered. */
  count: number
  totalFils: number
  hasProblems: boolean
  add: (item: MenuItem, selections: Selections, note: string, quantity: number) => void
  addCreation: (creation: Creation, quantity: number) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
}

const CartContext = createContext<CartValue | null>(null)

export function useCart(): CartValue {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart must be used inside CartProvider')
  return value
}

function lineKey(itemId: number, selections: Selections, note: string): string {
  const sorted = Object.keys(selections)
    .sort()
    .map((k) => [k, [...(selections[k] ?? [])].sort((a, b) => a - b)])
  return `${itemId}|${JSON.stringify(sorted)}|${note.trim().toLowerCase()}`
}

const creationLineKey = (creation: Creation) => `c|${creationKey(creation)}`

function isCreation(value: unknown): value is Creation {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.name === 'string' && typeof v.baseId === 'number' && (v.temperature === 'hot' || v.temperature === 'iced') && typeof v.extraShots === 'number'
}

function isStoredLine(value: unknown): value is StoredLine {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  const hasTarget = typeof v.itemId === 'number' || isCreation(v.creation)
  return (
    typeof v.key === 'string' &&
    hasTarget &&
    typeof v.quantity === 'number' &&
    typeof v.note === 'string' &&
    !!v.selections &&
    typeof v.selections === 'object'
  )
}

function readStored(): StoredLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isStoredLine).slice(0, 30) : []
  } catch {
    return []
  }
}

/** The lines to send to the server. The server prices every one of them again. */
export function toOrderLines(lines: Pick<CartLine, 'itemId' | 'quantity' | 'selections' | 'note' | 'creation'>[]): OrderLineInput[] {
  return lines.map((l) =>
    l.creation
      ? { quantity: l.quantity, selections: {}, note: l.note || undefined, creation: l.creation }
      : { itemId: l.itemId ?? undefined, quantity: l.quantity, selections: l.selections, note: l.note || undefined },
  )
}

/** The cart is kept on this device, so it survives a refresh and signing in. Prices are never stored. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<StoredLine[]>(readStored)
  const { itemsById, status } = useMenu()
  const builder = useBuilder()

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    } catch {
      /* storage full or unavailable: the cart simply will not persist */
    }
  }, [stored])

  const add = useCallback((item: MenuItem, selections: Selections, note: string, quantity: number) => {
    const key = lineKey(item.id, selections, note)
    setStored((lines) => {
      const existing = lines.find((l) => l.key === key)
      if (existing) {
        return lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + quantity) } : l))
      }
      return [...lines, { key, itemId: item.id, quantity: Math.min(MAX_QUANTITY, quantity), selections, note: note.trim() }]
    })
  }, [])

  const addCreation = useCallback((creation: Creation, quantity: number) => {
    const clean: Creation = { ...creation, name: cleanCreationName(creation.name) || 'My coffee' }
    const key = creationLineKey(clean)
    setStored((lines) => {
      const existing = lines.find((l) => l.key === key)
      if (existing) {
        return lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + quantity) } : l))
      }
      return [...lines, { key, itemId: null, quantity: Math.min(MAX_QUANTITY, quantity), selections: {}, note: '', creation: clean }]
    })
  }, [])

  const setQuantity = useCallback((key: string, quantity: number) => {
    setStored((lines) =>
      lines.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(MAX_QUANTITY, quantity)) } : l)),
    )
  }, [])

  const remove = useCallback((key: string) => setStored((lines) => lines.filter((l) => l.key !== key)), [])
  const clear = useCallback(() => setStored([]), [])

  const value = useMemo<CartValue>(() => {
    const menuReady = status === 'ready'
    const builderReady = builder.status === 'ready' && builder.data !== null
    const lines: CartLine[] = stored.map((line) => {
      if (line.creation) {
        // Before the builder's options load we cannot tell what it costs, so it is not called a problem yet.
        const described = builderReady ? describeCreation(line.creation, builder.data!) : null
        const problem = builderReady && !described?.ok ? 'unavailable' : null
        const unit = described?.ok ? described.unitPriceFils : 0
        return {
          ...line,
          item: null,
          problem,
          unitPriceFils: unit,
          lineTotalFils: problem ? 0 : unit * line.quantity,
          modifiers: described?.ok ? described.modifiers : [],
          name: line.creation.name,
        }
      }
      const item = line.itemId != null ? (itemsById.get(line.itemId) ?? null) : null
      // Before the menu loads we cannot tell, so do not call anything missing yet.
      const problem = !menuReady ? null : !item ? 'missing' : item.soldOut ? 'sold_out' : null
      const unit = item ? unitPriceFils(item, line.selections) : 0
      return {
        ...line,
        item,
        problem,
        unitPriceFils: unit,
        lineTotalFils: problem || !item ? 0 : unit * line.quantity,
        modifiers: item ? describeSelections(item.groups, line.selections) : [],
        name: item?.name ?? 'This item',
      }
    })
    const orderable = lines.filter((l) => !l.problem && (l.item || l.creation))
    return {
      lines,
      count: orderable.reduce((sum, l) => sum + l.quantity, 0),
      totalFils: orderable.reduce((sum, l) => sum + l.lineTotalFils, 0),
      hasProblems: lines.some((l) => l.problem),
      add,
      addCreation,
      setQuantity,
      remove,
      clear,
    }
  }, [stored, itemsById, status, builder.status, builder.data, add, addCreation, setQuantity, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
