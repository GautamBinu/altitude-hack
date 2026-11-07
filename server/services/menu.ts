import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { MenuCategory, MenuGroup, MenuItem, Temperature } from '../../shared/types'
import { db } from '../db'
import type { PricingItem } from '../domain/pricing'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

/** Menu photos live in public/images/menu (or dist/images/menu once built). */
function imageRoots(): string[] {
  return [resolve('dist/images/menu'), resolve('public/images/menu')]
}

/**
 * Returns the public URL of the item's photo, or null if the team has not added one yet.
 * A photo uploaded from the dashboard wins; otherwise a file dropped into public/images/menu.
 */
function imageUrlFor(slug: string, uploaded: string | null): string | null {
  if (uploaded) return uploaded
  for (const root of imageRoots()) {
    for (const ext of IMAGE_EXTENSIONS) {
      if (existsSync(join(root, `${slug}.${ext}`))) return `/images/menu/${slug}.${ext}`
    }
  }
  return null
}

interface CategoryRow { id: number; slug: string; name: string }
interface ItemRow {
  id: number
  category_id: number
  slug: string
  name: string
  description: string
  price_fils: number
  temperature: Temperature
  caffeine_free: number
  prep_seconds: number
  sold_out: number
  hidden: number
  image: string | null
  kind: 'drink' | 'food'
  category_slug: string
}
interface GroupRow {
  item_id: number
  id: number
  key: string
  name: string
  kind: 'single' | 'multi'
  required: number
  show_default: number
  inline_label: number
}
interface OptionRow {
  id: number
  group_id: number
  name: string
  price_delta_fils: number
  is_default: number
}

interface MenuData {
  categories: CategoryRow[]
  items: ItemRow[]
  groupsByItem: Map<number, MenuGroup[]>
}

function loadMenuData(itemFilter?: number[]): MenuData {
  const categories = db.prepare('SELECT id, slug, name FROM categories ORDER BY sort_order, id').all() as CategoryRow[]

  let items: ItemRow[]
  if (itemFilter) {
    if (itemFilter.length === 0) return { categories, items: [], groupsByItem: new Map() }
    const marks = itemFilter.map(() => '?').join(',')
    items = db
      .prepare(`SELECT i.*, c.slug AS category_slug FROM items i JOIN categories c ON c.id = i.category_id WHERE i.id IN (${marks}) ORDER BY i.sort_order, i.id`)
      .all(...itemFilter) as ItemRow[]
  } else {
    items = db
      .prepare('SELECT i.*, c.slug AS category_slug FROM items i JOIN categories c ON c.id = i.category_id WHERE i.hidden = 0 ORDER BY i.sort_order, i.id')
      .all() as ItemRow[]
  }

  const links = db
    .prepare(
      `SELECT iog.item_id, g.id, g.key, g.name, g.kind, g.required, g.show_default, g.inline_label
       FROM item_option_groups iog
       JOIN option_groups g ON g.id = iog.group_id
       ORDER BY iog.item_id, iog.sort_order, g.sort_order`,
    )
    .all() as GroupRow[]
  const options = db
    .prepare('SELECT id, group_id, name, price_delta_fils, is_default FROM options ORDER BY group_id, sort_order, id')
    .all() as OptionRow[]

  const optionsByGroup = new Map<number, OptionRow[]>()
  for (const option of options) {
    const list = optionsByGroup.get(option.group_id) ?? []
    list.push(option)
    optionsByGroup.set(option.group_id, list)
  }

  const groupsByItem = new Map<number, MenuGroup[]>()
  for (const link of links) {
    const group: MenuGroup = {
      id: link.id,
      key: link.key,
      name: link.name,
      kind: link.kind,
      required: link.required === 1,
      showDefault: link.show_default === 1,
      inlineLabel: link.inline_label === 1,
      options: (optionsByGroup.get(link.id) ?? []).map((o) => ({
        id: o.id,
        name: o.name,
        priceDeltaFils: o.price_delta_fils,
        isDefault: o.is_default === 1,
      })),
    }
    const list = groupsByItem.get(link.item_id) ?? []
    list.push(group)
    groupsByItem.set(link.item_id, list)
  }

  return { categories, items, groupsByItem }
}

/** The full customer menu. Hidden items are left out; sold-out items stay, marked as sold out. */
export function loadMenu(): MenuCategory[] {
  const { categories, items, groupsByItem } = loadMenuData()
  return categories
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      items: items
        .filter((item) => item.category_id === category.id)
        .map(
          (item): MenuItem => ({
            id: item.id,
            slug: item.slug,
            name: item.name,
            description: item.description,
            priceFils: item.price_fils,
            temperature: item.temperature,
            caffeineFree: item.caffeine_free === 1,
            soldOut: item.sold_out === 1,
            imageUrl: imageUrlFor(item.slug, item.image),
            kind: item.kind,
            groups: groupsByItem.get(item.id) ?? [],
          }),
        ),
    }))
    .filter((category) => category.items.length > 0)
}

/** Items as the pricing code needs them, looked up fresh from the database for every order. */
export function loadPricingItems(ids: number[]): Map<number, PricingItem> {
  const unique = [...new Set(ids)]
  const { items, groupsByItem } = loadMenuData(unique)
  const map = new Map<number, PricingItem>()
  for (const item of items) {
    map.set(item.id, {
      id: item.id,
      name: item.name,
      priceFils: item.price_fils,
      prepSeconds: item.prep_seconds,
      soldOut: item.sold_out === 1,
      hidden: item.hidden === 1,
      kind: item.kind,
      categorySlug: item.category_slug,
      groups: groupsByItem.get(item.id) ?? [],
    })
  }
  return map
}
