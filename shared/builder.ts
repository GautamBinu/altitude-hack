import type { CreationConfig } from './types'

/*
 * The coffee builder's rules, in one place. The browser uses `describeCreation` for the live price and the
 * cup; the server runs the very same function on the options in its database to price the real order.
 * Because both sides share it, the price a customer sees while building is the price they pay.
 */

export const MAX_EXTRA_SHOTS = 2
export const MAX_CREATION_NAME = 40

export type BuilderKind = 'base' | 'flavour' | 'shot' | 'topping' | 'sweetness'

export interface BuilderOptionView {
  id: number
  kind: BuilderKind
  name: string
  /** A base: the starting price of the drink. Anything else: the add-on price (a shot: per shot). */
  priceFils: number
  /** Hex colour for the cup illustration. */
  color: string | null
  temperature: 'hot' | 'iced' | 'both'
  usesMilk: boolean
  prepSeconds: number
}

export interface BuilderMilk {
  id: number
  name: string
  priceDeltaFils: number
  isDefault: boolean
}

/** Everything the builder offers right now. Options the team has switched off are not in it. */
export interface BuilderData {
  bases: BuilderOptionView[]
  flavours: BuilderOptionView[]
  sweetness: BuilderOptionView[]
  toppings: BuilderOptionView[]
  shot: BuilderOptionView | null
  milks: BuilderMilk[]
  maxExtraShots: number
}

export type CreationRecipe = CreationConfig & { name: string }

export type SubmitStatus = 'none' | 'pending' | 'approved' | 'rejected'

/** A creation a customer saved. */
export interface SavedCreation {
  id: number
  name: string
  config: CreationConfig
  submitStatus: SubmitStatus
  rejectReason: string | null
  createdAt: string
  /** Null when an option it uses has since been removed, so it cannot be made right now. */
  priceFils: number | null
  modifiers: string[]
}

/** A creation on the community board. */
export interface CommunityCreation {
  id: number
  name: string
  authorFirstName: string
  config: CreationConfig
  priceFils: number
  modifiers: string[]
  isSample: boolean
}

export interface Described {
  ok: true
  unitPriceFils: number
  prepSeconds: number
  /** One entry per choice, for the barista and the order screens. */
  modifiers: string[]
  /** The config with defaults filled in: the milk when the drink takes one, none when it does not. */
  config: CreationConfig
  base: BuilderOptionView
  flavour: BuilderOptionView | null
  topping: BuilderOptionView | null
  sweetness: BuilderOptionView | null
  milk: BuilderMilk | null
}

export type Check = Described | { ok: false; message: string }

/** Whether an option can be made at this temperature. Strawberry, for one, is iced only. */
export const allows = (option: BuilderOptionView, temperature: 'hot' | 'iced') => option.temperature === 'both' || option.temperature === temperature

function find(list: BuilderOptionView[], id: number | null | undefined): BuilderOptionView | null | undefined {
  if (id == null) return null
  return list.find((o) => o.id === id)
}

/** Checks a recipe against what is on offer and works out its price, prep time and a description. */
export function describeCreation(input: CreationConfig, data: BuilderData): Check {
  const base = data.bases.find((b) => b.id === input.baseId)
  if (!base) return { ok: false, message: 'That base is no longer on offer.' }
  if (input.temperature !== 'hot' && input.temperature !== 'iced') return { ok: false, message: 'Choose hot or iced.' }
  if (!allows(base, input.temperature)) {
    return { ok: false, message: `${base.name} is only made ${base.temperature === 'hot' ? 'hot' : 'iced'}.` }
  }

  const flavour = find(data.flavours, input.flavourId)
  if (flavour === undefined) return { ok: false, message: 'That flavour is no longer on offer.' }
  if (flavour && !allows(flavour, input.temperature)) {
    return { ok: false, message: `${flavour.name} is only made ${flavour.temperature === 'hot' ? 'hot' : 'iced'}.` }
  }
  const sweetness = find(data.sweetness, input.sweetnessId)
  if (sweetness === undefined) return { ok: false, message: 'That sweetness is no longer on offer.' }
  const topping = find(data.toppings, input.toppingId)
  if (topping === undefined) return { ok: false, message: 'That topping is no longer on offer.' }
  if (topping && !allows(topping, input.temperature)) {
    return { ok: false, message: `${topping.name} is only made ${topping.temperature === 'hot' ? 'hot' : 'iced'}.` }
  }

  const shots = input.extraShots
  if (!Number.isInteger(shots) || shots < 0 || shots > Math.min(MAX_EXTRA_SHOTS, data.maxExtraShots)) {
    return { ok: false, message: `Choose between 0 and ${Math.min(MAX_EXTRA_SHOTS, data.maxExtraShots)} extra shots.` }
  }
  if (shots > 0 && !data.shot) return { ok: false, message: 'Extra shots are not on offer right now.' }

  // A drink takes milk when its base or its flavour does (Spanish, for one, is made with condensed milk).
  const takesMilk = base.usesMilk || (flavour?.usesMilk ?? false)
  let milk: BuilderMilk | null = null
  if (takesMilk) {
    if (data.milks.length === 0) return { ok: false, message: 'Milk is not on offer right now.' }
    milk = input.milkOptionId == null ? (data.milks.find((m) => m.isDefault) ?? data.milks[0]) : (data.milks.find((m) => m.id === input.milkOptionId) ?? null)
    if (!milk) return { ok: false, message: 'That milk is no longer on offer.' }
  }

  const unit =
    base.priceFils +
    (flavour?.priceFils ?? 0) +
    (data.shot ? data.shot.priceFils * shots : 0) +
    (sweetness?.priceFils ?? 0) +
    (topping?.priceFils ?? 0) +
    (milk?.priceDeltaFils ?? 0)
  const prep = base.prepSeconds + (flavour?.prepSeconds ?? 0) + (topping?.prepSeconds ?? 0) + (data.shot ? data.shot.prepSeconds * shots : 0)

  const modifiers: string[] = [input.temperature === 'hot' ? 'Hot' : 'Iced', base.name]
  if (milk) modifiers.push(milk.name)
  if (flavour) modifiers.push(flavour.name)
  if (shots > 0) modifiers.push(shots === 1 ? 'Extra shot' : `${shots} extra shots`)
  if (sweetness) modifiers.push(`Sweetness: ${sweetness.name}`)
  if (topping) modifiers.push(topping.name)

  return {
    ok: true,
    unitPriceFils: unit,
    prepSeconds: prep,
    modifiers,
    config: {
      baseId: base.id,
      temperature: input.temperature,
      milkOptionId: milk?.id ?? null,
      flavourId: flavour?.id ?? null,
      extraShots: shots,
      sweetnessId: sweetness?.id ?? null,
      toppingId: topping?.id ?? null,
    },
    base,
    flavour: flavour ?? null,
    topping: topping ?? null,
    sweetness: sweetness ?? null,
    milk,
  }
}

/** A name to start from, such as "Iced Rose Latte". The customer can change it. */
export function suggestName(d: Described): string {
  const parts = [d.config.temperature === 'iced' ? 'Iced' : null, d.flavour?.name, d.base.name].filter(Boolean)
  return parts.join(' ').slice(0, MAX_CREATION_NAME)
}

/** Where the builder starts: a hot latte if there is one, regular sweetness, no extras. */
export function defaultConfig(data: BuilderData): CreationConfig {
  const base = data.bases.find((b) => b.name.toLowerCase() === 'latte') ?? data.bases[0]
  const temperature: 'hot' | 'iced' = base && allows(base, 'hot') ? 'hot' : 'iced'
  const regular = data.sweetness.find((s) => s.name.toLowerCase() === 'regular')
  return {
    baseId: base?.id ?? 0,
    temperature,
    milkOptionId: data.milks.find((m) => m.isDefault)?.id ?? data.milks[0]?.id ?? null,
    flavourId: null,
    extraShots: 0,
    sweetnessId: regular?.id ?? null,
    toppingId: null,
  }
}

/** A name from a customer, tidied: no control characters or emoji, one line, short. Empty if nothing is left. */
export function cleanCreationName(name: string): string {
  return name
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CREATION_NAME)
    .trim()
}

/** The same recipe in the same order every time, so two equal recipes make the same cart line. */
export function creationKey(c: CreationConfig & { name?: string }): string {
  return JSON.stringify([c.name ?? '', c.baseId, c.temperature, c.milkOptionId ?? null, c.flavourId ?? null, c.extraShots, c.sweetnessId ?? null, c.toppingId ?? null])
}
