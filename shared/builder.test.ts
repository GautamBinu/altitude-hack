import { describe, expect, it } from 'vitest'
import { SEED_BUILDER } from '../server/seed-content'
import {
  cleanCreationName,
  creationKey,
  defaultConfig,
  describeCreation,
  suggestName,
  type BuilderData,
  type BuilderKind,
  type BuilderOptionView,
} from './builder'
import type { CreationConfig } from './types'

/** The seeded builder options with ids, the way the server serves them. */
function data(): BuilderData {
  let id = 1
  const all: BuilderOptionView[] = SEED_BUILDER.map((o) => ({
    id: id++,
    kind: o.kind as BuilderKind,
    name: o.name,
    priceFils: o.price,
    color: o.color ?? null,
    temperature: o.temperature ?? 'both',
    usesMilk: !!o.usesMilk,
    prepSeconds: o.prep ?? 0,
  }))
  const of = (kind: BuilderKind) => all.filter((o) => o.kind === kind)
  return {
    bases: of('base'),
    flavours: of('flavour'),
    sweetness: of('sweetness'),
    toppings: of('topping'),
    shot: of('shot')[0] ?? null,
    milks: [
      { id: 100, name: 'Regular milk', priceDeltaFils: 0, isDefault: true },
      { id: 101, name: 'Oatly', priceDeltaFils: 600, isDefault: false },
      { id: 102, name: 'Almond', priceDeltaFils: 600, isDefault: false },
    ],
    maxExtraShots: 2,
  }
}

const D = data()
const byName = (list: BuilderOptionView[], name: string) => list.find((o) => o.name === name)!
const latte = byName(D.bases, 'Latte')
const espresso = byName(D.bases, 'Espresso')
const coldBrew = byName(D.bases, 'Cold brew style')
const rose = byName(D.flavours, 'Rose')
const strawberry = byName(D.flavours, 'Strawberry')
const cream = byName(D.toppings, 'Whipped cream')
const light = byName(D.sweetness, 'Light')

const config = (over: Partial<CreationConfig> = {}): CreationConfig => ({
  baseId: latte.id, temperature: 'hot', milkOptionId: 100, flavourId: null, extraShots: 0, sweetnessId: null, toppingId: null, ...over,
})

describe('pricing a creation', () => {
  it('is the base price for a plain drink', () => {
    const r = describeCreation(config({ baseId: espresso.id }), D)
    expect(r.ok && r.unitPriceFils).toBe(espresso.priceFils)
  })

  it('adds every choice to the base price', () => {
    const r = describeCreation(
      config({ flavourId: rose.id, extraShots: 2, milkOptionId: 101, sweetnessId: light.id, toppingId: cream.id }),
      D,
    )
    // Latte 25 + Rose 3 + 2 shots 8 + Oatly 6 + Light 0 + whipped cream 3
    expect(r.ok && r.unitPriceFils).toBe(2500 + 300 + 800 + 600 + 0 + 300)
  })

  it('charges for an alternative milk but not the regular one', () => {
    const regular = describeCreation(config({ milkOptionId: 100 }), D)
    const oat = describeCreation(config({ milkOptionId: 101 }), D)
    expect(regular.ok && oat.ok && oat.unitPriceFils - regular.unitPriceFils).toBe(600)
  })

  it('ignores a milk choice on a drink that takes no milk', () => {
    const r = describeCreation(config({ baseId: espresso.id, milkOptionId: 101 }), D)
    expect(r.ok && r.unitPriceFils).toBe(espresso.priceFils)
    expect(r.ok && r.config.milkOptionId).toBeNull()
  })

  it('uses the regular milk when a milk drink does not say', () => {
    const r = describeCreation(config({ milkOptionId: null }), D)
    expect(r.ok && r.config.milkOptionId).toBe(100)
  })

  it('treats a flavour made with milk as taking milk, even on a black base', () => {
    const r = describeCreation(config({ baseId: espresso.id, flavourId: rose.id, milkOptionId: 101 }), D)
    expect(r.ok && r.config.milkOptionId).toBe(101)
    expect(r.ok && r.unitPriceFils).toBe(espresso.priceFils + rose.priceFils + 600)
  })

  it('adds up prep time from the base and the shots', () => {
    const r = describeCreation(config({ extraShots: 2 }), D)
    expect(r.ok && r.prepSeconds).toBe(latte.prepSeconds + 2 * D.shot!.prepSeconds)
  })

  it('describes the recipe for the barista, in order', () => {
    const r = describeCreation(config({ temperature: 'iced', flavourId: rose.id, extraShots: 1, milkOptionId: 101, sweetnessId: light.id, toppingId: cream.id }), D)
    expect(r.ok && r.modifiers).toEqual(['Iced', 'Latte', 'Oatly', 'Rose', 'Extra shot', 'Sweetness: Light', 'Whipped cream'])
  })
})

describe('refusing what cannot be made', () => {
  const fails = (c: CreationConfig, data = D) => {
    const r = describeCreation(c, data)
    return r.ok ? null : r.message
  }

  it('refuses an unknown or switched-off base', () => {
    expect(fails(config({ baseId: 9999 }))).toContain('base')
    expect(fails(config(), { ...D, bases: D.bases.filter((b) => b.id !== latte.id) })).toContain('base')
  })

  it('refuses a temperature the base is not made at', () => {
    expect(fails(config({ baseId: coldBrew.id, temperature: 'hot' }))).toContain('only made iced')
    expect(fails(config({ baseId: byName(D.bases, 'Espresso').id, temperature: 'iced' }))).toContain('only made hot')
  })

  it('refuses a flavour that is only made iced when the drink is hot', () => {
    expect(fails(config({ flavourId: strawberry.id, temperature: 'hot' }))).toContain('only made iced')
    expect(fails(config({ flavourId: strawberry.id, temperature: 'iced' }))).toBeNull()
  })

  it('refuses unknown flavours, sweetness, toppings and milks', () => {
    expect(fails(config({ flavourId: 9999 }))).toContain('flavour')
    expect(fails(config({ sweetnessId: 9999 }))).toContain('sweetness')
    expect(fails(config({ toppingId: 9999 }))).toContain('topping')
    expect(fails(config({ milkOptionId: 9999 }))).toContain('milk')
  })

  it('refuses too many, negative or fractional extra shots', () => {
    expect(fails(config({ extraShots: 3 }))).toContain('extra shots')
    expect(fails(config({ extraShots: -1 }))).toContain('extra shots')
    expect(fails(config({ extraShots: 1.5 }))).toContain('extra shots')
  })

  it('refuses an extra shot when shots are switched off', () => {
    expect(fails(config({ extraShots: 1 }), { ...D, shot: null })).toContain('not on offer')
  })

  it('refuses a temperature that is neither hot nor iced', () => {
    expect(fails({ ...config(), temperature: 'lukewarm' as 'hot' })).toContain('hot or iced')
  })

  it('refuses a milk drink when no milk is on offer', () => {
    expect(fails(config(), { ...D, milks: [] })).toContain('Milk')
  })
})

describe('names and starting points', () => {
  it('suggests a name from the choices', () => {
    const r = describeCreation(config({ temperature: 'iced', flavourId: rose.id }), D)
    expect(r.ok && suggestName(r)).toBe('Iced Rose Latte')
    const hot = describeCreation(config({ baseId: espresso.id }), D)
    expect(hot.ok && suggestName(hot)).toBe('Espresso')
  })

  it('cleans a name: no emoji, no control characters, one line, short', () => {
    expect(cleanCreationName('  Sunny \u{1F600}  Day\n\u0007 ')).toBe('Sunny Day')
    expect(cleanCreationName('x'.repeat(100))).toHaveLength(40)
    expect(cleanCreationName('\u{1F600}')).toBe('')
  })

  it('starts from a hot latte with regular sweetness and no extras', () => {
    const c = defaultConfig(D)
    expect(c).toMatchObject({ baseId: latte.id, temperature: 'hot', milkOptionId: 100, flavourId: null, extraShots: 0, toppingId: null })
    expect(c.sweetnessId).toBe(byName(D.sweetness, 'Regular').id)
    expect(describeCreation(c, D).ok).toBe(true)
  })

  it('falls back to iced when the first base is cold only', () => {
    const only = { ...D, bases: [coldBrew] }
    expect(defaultConfig(only).temperature).toBe('iced')
  })

  it('gives equal recipes the same key and different ones a different key', () => {
    expect(creationKey({ ...config(), name: 'A' })).toBe(creationKey({ ...config(), name: 'A' }))
    expect(creationKey({ ...config(), name: 'A' })).not.toBe(creationKey({ ...config({ extraShots: 1 }), name: 'A' }))
    expect(creationKey({ ...config(), name: 'A' })).not.toBe(creationKey({ ...config(), name: 'B' }))
  })
})
