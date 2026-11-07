import { describeSelections } from '../../shared/modifiers'
import type { OrderLineInput } from '../../shared/types'

/**
 * Server-side pricing. The client never sends a price: it sends item ids and option ids, and this
 * module works out what each line costs from the menu as it stands right now.
 */

export interface PricingOption {
  id: number
  name: string
  priceDeltaFils: number
  isDefault: boolean
}

export interface PricingGroup {
  id: number
  name: string
  kind: 'single' | 'multi'
  required: boolean
  showDefault: boolean
  inlineLabel: boolean
  options: PricingOption[]
}

export interface PricingItem {
  id: number
  name: string
  priceFils: number
  prepSeconds: number
  soldOut: boolean
  hidden: boolean
  /** A drink can be paid for with a Summit Box. */
  kind: 'drink' | 'food'
  categorySlug: string
  groups: PricingGroup[]
}

export interface PricedLine {
  /** Null for a builder creation. */
  itemId: number | null
  name: string
  quantity: number
  unitPriceFils: number
  lineTotalFils: number
  /** Prep time for one unit, in seconds. */
  prepSeconds: number
  modifiers: string[]
  note: string | null
  kind: 'drink' | 'food'
  categorySlug: string
  /** What was chosen, so the order can be repeated exactly. */
  selections: Record<string, number[]> | null
  /** The builder recipe, for a creation. */
  creation: string | null
}

export class OrderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

export function cleanNote(note: string | undefined | null): string | null {
  const cleaned = (note ?? '').replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, 140)
  return cleaned.length > 0 ? cleaned : null
}

export function priceLine(item: PricingItem | undefined, input: OrderLineInput): PricedLine {
  if (!item || item.hidden) {
    throw new OrderError('One of the items in your order is no longer on the menu.', 'item_unavailable', 409)
  }
  if (item.soldOut) {
    throw new OrderError(`${item.name} is sold out.`, 'sold_out', 409)
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 20) {
    throw new OrderError('Quantity must be between 1 and 20.', 'invalid_quantity')
  }

  const knownGroupIds = new Set(item.groups.map((g) => String(g.id)))
  for (const key of Object.keys(input.selections)) {
    if (!knownGroupIds.has(key)) {
      throw new OrderError(`${item.name} doesn't have that choice.`, 'invalid_selection')
    }
  }

  const chosen: Record<string, number[]> = {}
  let unitPrice = item.priceFils

  for (const group of item.groups) {
    const ids = [...new Set(input.selections[String(group.id)] ?? [])]
    const validIds = new Set(group.options.map((o) => o.id))
    if (ids.some((id) => !validIds.has(id))) {
      throw new OrderError(`That ${group.name.toLowerCase()} choice isn't available for ${item.name}.`, 'invalid_selection')
    }
    if (group.kind === 'single' && ids.length > 1) {
      throw new OrderError(`Pick one ${group.name.toLowerCase()} for ${item.name}.`, 'invalid_selection')
    }
    if (group.required && ids.length === 0) {
      throw new OrderError(`Choose a ${group.name.toLowerCase()} for ${item.name}.`, 'invalid_selection')
    }
    chosen[String(group.id)] = ids
    for (const option of group.options) {
      if (ids.includes(option.id)) unitPrice += option.priceDeltaFils
    }
  }

  return {
    itemId: item.id,
    name: item.name,
    quantity: input.quantity,
    unitPriceFils: unitPrice,
    lineTotalFils: unitPrice * input.quantity,
    prepSeconds: item.prepSeconds,
    modifiers: describeSelections(item.groups, chosen),
    note: cleanNote(input.note),
    kind: item.kind,
    categorySlug: item.categorySlug,
    selections: chosen,
    creation: null,
  }
}

export interface PricedOrder {
  lines: PricedLine[]
  subtotalFils: number
  /** Time to make the whole order: sum of prep time x quantity across lines. */
  prepSeconds: number
}

/** Prices a builder creation. Supplied by the builder module so this file stays free of the database. */
export type CreationPricer = (input: OrderLineInput) => PricedLine

export function priceOrder(
  items: Map<number, PricingItem>,
  lines: OrderLineInput[],
  priceCreation?: CreationPricer,
): PricedOrder {
  if (lines.length === 0) throw new OrderError('Your order is empty.', 'empty_order')
  const priced = lines.map((line) => {
    if (line.creation) {
      if (!priceCreation) throw new OrderError("Custom coffees aren't available right now.", 'creation_unavailable', 409)
      return priceCreation(line)
    }
    if (line.itemId == null) throw new OrderError('One of the lines has no item.', 'invalid_request')
    return priceLine(items.get(line.itemId), line)
  })
  return {
    lines: priced,
    subtotalFils: priced.reduce((sum, l) => sum + l.lineTotalFils, 0),
    prepSeconds: priced.reduce((sum, l) => sum + l.prepSeconds * l.quantity, 0),
  }
}
