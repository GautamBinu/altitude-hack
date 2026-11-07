import type { CreationConfig, MenuItem, OrderLineView } from '@shared/types'
import { defaultSelections, type Selections } from './pricing'

/**
 * Turn the choices saved on an earlier order back into choices that are valid on today's menu. If an
 * option has since been removed, that group falls back to its default rather than failing the whole line.
 */
export function selectionsFor(item: MenuItem, saved: Record<string, number[]> | null | undefined): Selections {
  const base = defaultSelections(item.groups)
  if (!saved) return base
  for (const group of item.groups) {
    const ids = (saved[String(group.id)] ?? []).filter((id) => group.options.some((o) => o.id === id))
    if (ids.length > 0) base[String(group.id)] = group.kind === 'single' ? [ids[0]] : ids
  }
  return base
}

export interface ReorderLine {
  itemId?: number | null
  quantity: number
  selections?: Record<string, number[]> | null
  note?: string | null
  /** A coffee from the builder. Put back as it was; checkout says if something in it has gone. */
  creation?: (CreationConfig & { name: string }) | null
}

interface CartApi {
  add: (item: MenuItem, selections: Selections, note: string, quantity: number) => void
  addCreation: (creation: CreationConfig & { name: string }, quantity: number) => void
}

/** Adds earlier lines to the cart. Returns how many went in and how many could not (sold out or gone). */
export function reorder(lines: (ReorderLine | OrderLineView)[], itemsById: Map<number, MenuItem>, cart: CartApi): { added: number; skipped: number } {
  let added = 0
  let skipped = 0
  for (const line of lines) {
    if (line.creation) {
      cart.addCreation(line.creation, Math.max(1, line.quantity))
      added++
      continue
    }
    const item = line.itemId != null ? itemsById.get(line.itemId) : undefined
    if (!item || item.soldOut) {
      skipped++
      continue
    }
    cart.add(item, selectionsFor(item, line.selections), line.note ?? '', Math.max(1, line.quantity))
    added++
  }
  return { added, skipped }
}
