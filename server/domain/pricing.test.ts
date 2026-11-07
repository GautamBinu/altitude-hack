import { describe, expect, it } from 'vitest'
import { OrderError, priceLine, priceOrder, type PricingItem } from './pricing'

const milk = {
  id: 10,
  name: 'Milk',
  kind: 'single' as const,
  required: true,
  showDefault: false,
  inlineLabel: true,
  options: [
    { id: 100, name: 'Regular milk', priceDeltaFils: 0, isDefault: true },
    { id: 101, name: 'Oatly', priceDeltaFils: 600, isDefault: false },
  ],
}
const temperature = {
  id: 11,
  name: 'Temperature',
  kind: 'single' as const,
  required: true,
  showDefault: true,
  inlineLabel: true,
  options: [
    { id: 110, name: 'Hot', priceDeltaFils: 0, isDefault: true },
    { id: 111, name: 'Iced', priceDeltaFils: 0, isDefault: false },
  ],
}
const toppings = {
  id: 12,
  name: 'Toppings',
  kind: 'multi' as const,
  required: false,
  showDefault: true,
  inlineLabel: false,
  options: [
    { id: 120, name: 'Granola', priceDeltaFils: 150, isDefault: false },
    { id: 121, name: 'Honey', priceDeltaFils: 0, isDefault: false },
  ],
}

const latte: PricingItem = {
  id: 1,
  name: 'Cafe Latte',
  priceFils: 2500,
  prepSeconds: 120,
  soldOut: false,
  hidden: false,
  kind: 'drink',
  categorySlug: 'espresso-bar',
  groups: [temperature, milk],
}
const bowl: PricingItem = { ...latte, id: 2, name: 'Acai Bowl', priceFils: 2400, prepSeconds: 240, groups: [toppings] }

describe('server-side pricing', () => {
  it('prices from the menu and adds option deltas', () => {
    const line = priceLine(latte, { itemId: 1, quantity: 2, selections: { '10': [101], '11': [111] } })
    expect(line.unitPriceFils).toBe(3100)
    expect(line.lineTotalFils).toBe(6200)
    expect(line.modifiers).toEqual(['Iced', 'Oatly'])
  })

  it('leaves the default milk off the line but keeps the temperature', () => {
    const line = priceLine(latte, { itemId: 1, quantity: 1, selections: { '10': [100], '11': [110] } })
    expect(line.modifiers).toEqual(['Hot'])
    expect(line.unitPriceFils).toBe(2500)
  })

  it('handles multi-select options and half-dirham prices exactly', () => {
    const line = priceLine(bowl, { itemId: 2, quantity: 1, selections: { '12': [120, 121] } })
    expect(line.unitPriceFils).toBe(2550)
    expect(line.modifiers).toEqual(['Toppings: Granola, Honey'])
  })

  it('rejects a missing required choice', () => {
    expect(() => priceLine(latte, { itemId: 1, quantity: 1, selections: { '10': [100] } })).toThrow(OrderError)
  })

  it('rejects an option that belongs to a different group or item', () => {
    expect(() => priceLine(latte, { itemId: 1, quantity: 1, selections: { '10': [111], '11': [110] } })).toThrow(/isn't available/)
    expect(() => priceLine(latte, { itemId: 1, quantity: 1, selections: { '99': [1], '10': [100], '11': [110] } })).toThrow(OrderError)
  })

  it('rejects two choices in a single-choice group', () => {
    expect(() => priceLine(latte, { itemId: 1, quantity: 1, selections: { '10': [100, 101], '11': [110] } })).toThrow(/Pick one/)
  })

  it('rejects sold-out, hidden and unknown items', () => {
    const sel = { '10': [100], '11': [110] }
    expect(() => priceLine({ ...latte, soldOut: true }, { itemId: 1, quantity: 1, selections: sel })).toThrow(/sold out/)
    expect(() => priceLine({ ...latte, hidden: true }, { itemId: 1, quantity: 1, selections: sel })).toThrow(OrderError)
    expect(() => priceLine(undefined, { itemId: 99, quantity: 1, selections: {} })).toThrow(OrderError)
  })

  it('rejects bad quantities', () => {
    const sel = { '10': [100], '11': [110] }
    for (const quantity of [0, -1, 21, 1.5]) {
      expect(() => priceLine(latte, { itemId: 1, quantity, selections: sel })).toThrow(OrderError)
    }
  })

  it('cleans the barista note', () => {
    const line = priceLine(latte, { itemId: 1, quantity: 1, selections: { '10': [100], '11': [110] }, note: '  extra\nhot\t  ' })
    expect(line.note).toBe('extra hot')
  })

  it('totals an order and its prep time', () => {
    const items = new Map([[1, latte], [2, bowl]])
    const order = priceOrder(items, [
      { itemId: 1, quantity: 2, selections: { '10': [100], '11': [110] } },
      { itemId: 2, quantity: 1, selections: { '12': [] } },
    ])
    expect(order.subtotalFils).toBe(2 * 2500 + 2400)
    expect(order.prepSeconds).toBe(2 * 120 + 240)
  })

  it('rejects an empty order', () => {
    expect(() => priceOrder(new Map(), [])).toThrow(/empty/)
  })
})
