import type { Temperature } from './types'

/** Types for the dashboard's management screens. Customers never see these. */

export interface AdminOption {
  id: number
  name: string
  priceDeltaFils: number
  isDefault: boolean
  unconfirmed: boolean
}

export interface AdminGroup {
  id: number
  key: string
  name: string
  kind: 'single' | 'multi'
  required: boolean
  showDefault: boolean
  inlineLabel: boolean
  options: AdminOption[]
  /** How many menu items offer this group. */
  usedBy: number
}

export interface AdminItem {
  id: number
  categoryId: number
  slug: string
  name: string
  description: string
  priceFils: number
  priceUnconfirmed: boolean
  temperature: Temperature
  caffeineFree: boolean
  prepSeconds: number
  soldOut: boolean
  hidden: boolean
  kind: 'drink' | 'food'
  tags: string[]
  imageUrl: string | null
  groupIds: number[]
}

export interface AdminCategory {
  id: number
  slug: string
  name: string
  items: AdminItem[]
}

export interface AdminBuilderOption {
  id: number
  kind: 'base' | 'flavour' | 'shot' | 'topping' | 'sweetness'
  name: string
  priceFils: number
  color: string | null
  temperature: 'hot' | 'iced' | 'both'
  usesMilk: boolean
  prepSeconds: number
  available: boolean
  unconfirmed: boolean
}

export interface SummitBoxPrice {
  size: number
  priceFils: number
}

export interface AdminMenu {
  categories: AdminCategory[]
  groups: AdminGroup[]
  builder: AdminBuilderOption[]
  summitBox: SummitBoxPrice[]
}

/* ---------- Promotions ---------- */

export interface AdminPromoDrink {
  itemId: number | null
  headline: string
  copy: string
  imageUrl: string | null
  endsAt: string | null
  active: boolean
}

export interface AdminBanner {
  id: number
  title: string
  body: string
  imageUrl: string | null
  itemId: number | null
  active: boolean
  startsAt: string | null
  endsAt: string | null
  isSample: boolean
}

export interface AdminCode {
  id: number
  code: string
  kind: 'percent' | 'fixed'
  /** Percent (1 to 100), or fils for a fixed amount. */
  value: number
  startsAt: string | null
  endsAt: string | null
  active: boolean
  maxUses: number | null
  uses: number
  isSample: boolean
}

export interface AdminPromotions {
  drink: AdminPromoDrink | null
  banners: AdminBanner[]
  codes: AdminCode[]
}

/** "32.50" or "32" to fils. Null when the text is not a price. */
export function parseAedToFils(text: string): number | null {
  const cleaned = text.trim().replace(/\s*(aed)?$/i, '')
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(cleaned)) return null
  const [whole, frac = ''] = cleaned.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

/** 3250 to "32.50", 2500 to "25". */
export function filsToAedInput(fils: number): string {
  const whole = Math.floor(fils / 100)
  const rest = fils % 100
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, '0')}`
}
