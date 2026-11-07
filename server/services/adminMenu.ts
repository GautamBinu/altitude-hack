import type { AdminBuilderOption, AdminCategory, AdminGroup, AdminItem, AdminMenu, SummitBoxPrice } from '../../shared/admin'
import type { Temperature } from '../../shared/types'
import { db, inTransaction } from '../db'
import { OrderError } from '../domain/pricing'
import { publishMenuChanged } from '../realtime'
import { slugify } from '../slug'
import { getSettings, saveSettings } from './settings'
import { assertLocalImage } from './uploads'
import { imageUrlForSlug } from './menu'

/* Everything the dashboard can change about the menu. Each change is applied in one transaction and
   then announced, so customers who have the menu open see it straight away. */

interface ItemRow {
  id: number
  category_id: number
  slug: string
  name: string
  description: string
  price_fils: number
  price_unconfirmed: number
  temperature: Temperature
  caffeine_free: number
  prep_seconds: number
  sold_out: number
  hidden: number
  sort_order: number
  tags: string
  image: string | null
  kind: 'drink' | 'food'
}

export function getAdminMenu(): AdminMenu {
  const categories = db.prepare('SELECT id, slug, name FROM categories ORDER BY sort_order, id').all() as { id: number; slug: string; name: string }[]
  const items = db.prepare('SELECT * FROM items ORDER BY sort_order, id').all() as ItemRow[]
  const links = db.prepare('SELECT item_id, group_id FROM item_option_groups ORDER BY item_id, sort_order').all() as { item_id: number; group_id: number }[]

  const groupsByItem = new Map<number, number[]>()
  for (const link of links) groupsByItem.set(link.item_id, [...(groupsByItem.get(link.item_id) ?? []), link.group_id])

  const toItem = (row: ItemRow): AdminItem => ({
    id: row.id,
    categoryId: row.category_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceFils: row.price_fils,
    priceUnconfirmed: row.price_unconfirmed === 1,
    temperature: row.temperature,
    caffeineFree: row.caffeine_free === 1,
    prepSeconds: row.prep_seconds,
    soldOut: row.sold_out === 1,
    hidden: row.hidden === 1,
    kind: row.kind,
    tags: safeTags(row.tags),
    imageUrl: imageUrlForSlug(row.slug, row.image),
    groupIds: groupsByItem.get(row.id) ?? [],
  })

  const groupRows = db.prepare('SELECT * FROM option_groups ORDER BY sort_order, id').all() as {
    id: number; key: string; name: string; kind: 'single' | 'multi'; required: number; show_default: number; inline_label: number
  }[]
  const optionRows = db.prepare('SELECT * FROM options ORDER BY group_id, sort_order, id').all() as {
    id: number; group_id: number; name: string; price_delta_fils: number; price_unconfirmed: number; is_default: number
  }[]
  const used = db.prepare('SELECT group_id, COUNT(*) AS n FROM item_option_groups GROUP BY group_id').all() as { group_id: number; n: number }[]
  const usedBy = new Map(used.map((u) => [u.group_id, u.n]))

  const groups: AdminGroup[] = groupRows.map((g) => ({
    id: g.id,
    key: g.key,
    name: g.name,
    kind: g.kind,
    required: g.required === 1,
    showDefault: g.show_default === 1,
    inlineLabel: g.inline_label === 1,
    usedBy: usedBy.get(g.id) ?? 0,
    options: optionRows
      .filter((o) => o.group_id === g.id)
      .map((o) => ({ id: o.id, name: o.name, priceDeltaFils: o.price_delta_fils, isDefault: o.is_default === 1, unconfirmed: o.price_unconfirmed === 1 })),
  }))

  const builder = db.prepare('SELECT * FROM builder_options ORDER BY kind, sort_order, id').all() as {
    id: number; kind: AdminBuilderOption['kind']; name: string; price_fils: number; color: string | null
    temperature: 'hot' | 'iced' | 'both'; uses_milk: number; prep_seconds: number; available: number; unconfirmed: number
  }[]

  return {
    categories: categories.map<AdminCategory>((c) => ({ ...c, items: items.filter((i) => i.category_id === c.id).map(toItem) })),
    groups,
    builder: builder.map((b) => ({
      id: b.id, kind: b.kind, name: b.name, priceFils: b.price_fils, color: b.color, temperature: b.temperature,
      usesMilk: b.uses_milk === 1, prepSeconds: b.prep_seconds, available: b.available === 1, unconfirmed: b.unconfirmed === 1,
    })),
    summitBox: getSettings().summitBox,
  }
}

function safeTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

const cleanName = (value: string, label: string, max = 60): string => {
  const name = value.replace(/\s+/g, ' ').trim()
  if (name.length < 1) throw new OrderError(`${label} can't be empty.`, 'invalid_request')
  if (name.length > max) throw new OrderError(`${label} can be up to ${max} characters.`, 'invalid_request')
  return name
}

function uniqueSlug(table: 'items' | 'categories', base: string): string {
  const root = slugify(base) || 'item'
  let slug = root
  let n = 2
  while (db.prepare(`SELECT 1 FROM ${table} WHERE slug = ?`).get(slug)) slug = `${root}-${n++}`
  return slug
}

/* ---------- Categories ---------- */

export function createCategory(name: string): number {
  const clean = cleanName(name, 'The category name', 40)
  const id = inTransaction(() => {
    const max = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories').get() as { m: number }).m
    return Number(db.prepare('INSERT INTO categories (slug, name, sort_order) VALUES (?, ?, ?)').run(uniqueSlug('categories', clean), clean, max + 1).lastInsertRowid)
  })
  publishMenuChanged()
  return id
}

export function renameCategory(id: number, name: string): void {
  const info = db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(cleanName(name, 'The category name', 40), id)
  if (info.changes === 0) throw new OrderError('Category not found.', 'not_found', 404)
  publishMenuChanged()
}

function move(table: 'categories' | 'items', id: number, direction: 'up' | 'down', scope: string, scopeParam: unknown[]): void {
  inTransaction(() => {
    const rows = db.prepare(`SELECT id FROM ${table} ${scope} ORDER BY sort_order, id`).all(...scopeParam) as { id: number }[]
    const index = rows.findIndex((r) => r.id === id)
    if (index < 0) throw new OrderError('Not found.', 'not_found', 404)
    const swap = direction === 'up' ? index - 1 : index + 1
    if (swap < 0 || swap >= rows.length) return
    const order = rows.map((r) => r.id)
    ;[order[index], order[swap]] = [order[swap], order[index]]
    const update = db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`)
    order.forEach((rowId, i) => update.run(i, rowId))
  })
  publishMenuChanged()
}

export const moveCategory = (id: number, direction: 'up' | 'down') => move('categories', id, direction, '', [])

/** Deleting a category deletes its items too. Orders already placed keep their own record of what was bought. */
export function deleteCategory(id: number): void {
  inTransaction(() => {
    const items = db.prepare('SELECT id FROM items WHERE category_id = ?').all(id) as { id: number }[]
    for (const item of items) removeItem(item.id)
    const info = db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    if (info.changes === 0) throw new OrderError('Category not found.', 'not_found', 404)
  })
  publishMenuChanged()
}

/* ---------- Items ---------- */

export interface ItemInput {
  categoryId: number
  name: string
  description: string
  priceFils: number
  priceUnconfirmed?: boolean
  temperature: Temperature
  caffeineFree: boolean
  prepSeconds: number
  kind: 'drink' | 'food'
  tags: string[]
  image?: string | null
  soldOut?: boolean
  hidden?: boolean
  groupIds: number[]
}

function cleanTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase().replace(/[^a-z0-9 -]/g, '')).filter((t) => t.length > 0 && t.length <= 24))].slice(0, 12)
}

/** A hot-or-iced item needs the temperature choice; any other item must not have it. */
function reconcileGroups(groupIds: number[], temperature: Temperature): number[] {
  const temp = db.prepare(`SELECT id FROM option_groups WHERE key = 'temperature'`).get() as { id: number } | undefined
  const ids = [...new Set(groupIds)].filter((g) => db.prepare('SELECT 1 FROM option_groups WHERE id = ?').get(g))
  if (!temp) return ids
  const without = ids.filter((g) => g !== temp.id)
  return temperature === 'both' ? [temp.id, ...without] : without
}

function writeGroups(itemId: number, groupIds: number[]): void {
  db.prepare('DELETE FROM item_option_groups WHERE item_id = ?').run(itemId)
  const insert = db.prepare('INSERT INTO item_option_groups (item_id, group_id, sort_order) VALUES (?, ?, ?)')
  groupIds.forEach((g, i) => insert.run(itemId, g, i))
}

export function createItem(input: ItemInput): number {
  const id = inTransaction(() => {
    if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(input.categoryId)) throw new OrderError('Pick a category.', 'invalid_request')
    const name = cleanName(input.name, 'The item name')
    const max = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM items WHERE category_id = ?').get(input.categoryId) as { m: number }).m
    const res = db
      .prepare(
        `INSERT INTO items (category_id, slug, name, description, price_fils, price_unconfirmed, temperature, caffeine_free,
                            prep_seconds, sold_out, hidden, sort_order, tags, kind, image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.categoryId, uniqueSlug('items', name), name, input.description.trim().slice(0, 240), input.priceFils,
        input.priceUnconfirmed ? 1 : 0, input.temperature, input.caffeineFree ? 1 : 0, input.prepSeconds,
        input.soldOut ? 1 : 0, input.hidden ? 1 : 0, max + 1, JSON.stringify(cleanTags(input.tags)), input.kind,
        assertLocalImage(input.image),
      )
    const itemId = Number(res.lastInsertRowid)
    writeGroups(itemId, reconcileGroups(input.groupIds, input.temperature))
    return itemId
  })
  publishMenuChanged()
  return id
}

export type ItemPatch = Partial<ItemInput>

export function updateItem(id: number, patch: ItemPatch): void {
  inTransaction(() => {
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined
    if (!row) throw new OrderError('Item not found.', 'not_found', 404)

    const temperature = patch.temperature ?? row.temperature
    const priceChanged = patch.priceFils != null && patch.priceFils !== row.price_fils
    const unconfirmed =
      patch.priceUnconfirmed != null ? patch.priceUnconfirmed : priceChanged ? false : row.price_unconfirmed === 1

    db.prepare(
      `UPDATE items SET category_id = ?, name = ?, description = ?, price_fils = ?, price_unconfirmed = ?, temperature = ?,
              caffeine_free = ?, prep_seconds = ?, sold_out = ?, hidden = ?, tags = ?, kind = ?, image = ? WHERE id = ?`,
    ).run(
      patch.categoryId ?? row.category_id,
      patch.name != null ? cleanName(patch.name, 'The item name') : row.name,
      patch.description != null ? patch.description.trim().slice(0, 240) : row.description,
      patch.priceFils ?? row.price_fils,
      unconfirmed ? 1 : 0,
      temperature,
      (patch.caffeineFree ?? row.caffeine_free === 1) ? 1 : 0,
      patch.prepSeconds ?? row.prep_seconds,
      (patch.soldOut ?? row.sold_out === 1) ? 1 : 0,
      (patch.hidden ?? row.hidden === 1) ? 1 : 0,
      patch.tags ? JSON.stringify(cleanTags(patch.tags)) : row.tags,
      patch.kind ?? row.kind,
      patch.image !== undefined ? assertLocalImage(patch.image) : row.image,
      id,
    )

    if (patch.groupIds || patch.temperature) {
      const current = patch.groupIds ?? (db.prepare('SELECT group_id FROM item_option_groups WHERE item_id = ? ORDER BY sort_order').all(id) as { group_id: number }[]).map((g) => g.group_id)
      writeGroups(id, reconcileGroups(current, temperature))
    }
  })
  publishMenuChanged()
}

export const moveItem = (id: number, direction: 'up' | 'down') => {
  const row = db.prepare('SELECT category_id FROM items WHERE id = ?').get(id) as { category_id: number } | undefined
  if (!row) throw new OrderError('Item not found.', 'not_found', 404)
  move('items', id, direction, 'WHERE category_id = ?', [row.category_id])
}

function removeItem(id: number): void {
  db.prepare('UPDATE promo_drink SET item_id = NULL, active = 0 WHERE item_id = ?').run(id)
  db.prepare('UPDATE promos SET item_id = NULL WHERE item_id = ?').run(id)
  db.prepare('DELETE FROM favourites WHERE item_id = ?').run(id)
  db.prepare('DELETE FROM items WHERE id = ?').run(id)
}

/** Orders already placed keep the name and price they were bought at, so deleting an item never changes history. */
export function deleteItem(id: number): void {
  inTransaction(() => {
    if (!db.prepare('SELECT 1 FROM items WHERE id = ?').get(id)) throw new OrderError('Item not found.', 'not_found', 404)
    removeItem(id)
  })
  publishMenuChanged()
}

/* ---------- Choices (option groups) ---------- */

export interface GroupInput {
  name: string
  kind: 'single' | 'multi'
  required: boolean
  showDefault: boolean
  inlineLabel: boolean
  options: { id?: number; name: string; priceDeltaFils: number; isDefault: boolean; unconfirmed?: boolean }[]
}

function checkOptions(input: GroupInput): GroupInput['options'] {
  if (input.options.length === 0) throw new OrderError('Add at least one option.', 'invalid_request')
  if (input.options.length > 30) throw new OrderError('A choice can have up to 30 options.', 'invalid_request')
  const names = new Set<string>()
  const options = input.options.map((o) => {
    const name = cleanName(o.name, 'An option name', 40)
    if (names.has(name.toLowerCase())) throw new OrderError(`"${name}" is listed twice.`, 'invalid_request')
    names.add(name.toLowerCase())
    return { ...o, name }
  })
  if (input.kind === 'single') {
    const defaults = options.filter((o) => o.isDefault)
    if (defaults.length > 1) throw new OrderError('Only one option can be the default.', 'invalid_request')
    if (input.required && defaults.length === 0) options[0].isDefault = true
  }
  return options
}

export function createGroup(input: GroupInput): number {
  const name = cleanName(input.name, 'The choice name', 40)
  const options = checkOptions(input)
  const id = inTransaction(() => {
    const key = (() => {
      const root = slugify(name) || 'choice'
      let k = root
      let n = 2
      while (db.prepare('SELECT 1 FROM option_groups WHERE key = ?').get(k)) k = `${root}-${n++}`
      return k
    })()
    const max = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM option_groups').get() as { m: number }).m
    const gid = Number(
      db
        .prepare('INSERT INTO option_groups (key, name, kind, required, show_default, inline_label, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(key, name, input.kind, input.required ? 1 : 0, input.showDefault ? 1 : 0, input.inlineLabel ? 1 : 0, max + 1).lastInsertRowid,
    )
    const insert = db.prepare('INSERT INTO options (group_id, name, price_delta_fils, price_unconfirmed, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
    options.forEach((o, i) => insert.run(gid, o.name, o.priceDeltaFils, o.unconfirmed ? 1 : 0, o.isDefault ? 1 : 0, i))
    return gid
  })
  publishMenuChanged()
  return id
}

/** Options with an id are updated in place (so saved carts and favourites keep working); new ones are added; missing ones are removed. */
export function updateGroup(id: number, input: GroupInput): void {
  const name = cleanName(input.name, 'The choice name', 40)
  const options = checkOptions(input)
  inTransaction(() => {
    if (!db.prepare('SELECT 1 FROM option_groups WHERE id = ?').get(id)) throw new OrderError('Choice not found.', 'not_found', 404)
    db.prepare('UPDATE option_groups SET name = ?, kind = ?, required = ?, show_default = ?, inline_label = ? WHERE id = ?').run(
      name, input.kind, input.required ? 1 : 0, input.showDefault ? 1 : 0, input.inlineLabel ? 1 : 0, id,
    )
    const existing = (db.prepare('SELECT id FROM options WHERE group_id = ?').all(id) as { id: number }[]).map((o) => o.id)
    const keep = new Set(options.filter((o) => o.id != null && existing.includes(o.id)).map((o) => o.id!))
    for (const oldId of existing) if (!keep.has(oldId)) db.prepare('DELETE FROM options WHERE id = ?').run(oldId)
    const update = db.prepare('UPDATE options SET name = ?, price_delta_fils = ?, price_unconfirmed = ?, is_default = ?, sort_order = ? WHERE id = ? AND group_id = ?')
    const insert = db.prepare('INSERT INTO options (group_id, name, price_delta_fils, price_unconfirmed, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
    options.forEach((o, i) => {
      if (o.id != null && keep.has(o.id)) update.run(o.name, o.priceDeltaFils, o.unconfirmed ? 1 : 0, o.isDefault ? 1 : 0, i, o.id, id)
      else insert.run(id, o.name, o.priceDeltaFils, o.unconfirmed ? 1 : 0, o.isDefault ? 1 : 0, i)
    })
  })
  publishMenuChanged()
}

export function deleteGroup(id: number): void {
  inTransaction(() => {
    const row = db.prepare('SELECT key FROM option_groups WHERE id = ?').get(id) as { key: string } | undefined
    if (!row) throw new OrderError('Choice not found.', 'not_found', 404)
    if (row.key === 'temperature') throw new OrderError('The temperature choice is built in and cannot be deleted.', 'invalid_request')
    const used = (db.prepare('SELECT COUNT(*) AS n FROM item_option_groups WHERE group_id = ?').get(id) as { n: number }).n
    if (used > 0) throw new OrderError(`${used} ${used === 1 ? 'item uses' : 'items use'} this choice. Remove it from them first.`, 'in_use', 409)
    db.prepare('DELETE FROM option_groups WHERE id = ?').run(id)
  })
  publishMenuChanged()
}

/* ---------- Builder options ---------- */

export interface BuilderInput {
  kind: AdminBuilderOption['kind']
  name: string
  priceFils: number
  color?: string | null
  temperature?: 'hot' | 'iced' | 'both'
  usesMilk?: boolean
  prepSeconds?: number
  available?: boolean
  unconfirmed?: boolean
}

const cleanColor = (c: string | null | undefined): string | null => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : null)

export function createBuilderOption(input: BuilderInput): number {
  const id = inTransaction(() => {
    const max = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM builder_options WHERE kind = ?').get(input.kind) as { m: number }).m
    return Number(
      db
        .prepare(
          `INSERT INTO builder_options (kind, name, price_fils, color, temperature, uses_milk, prep_seconds, available, unconfirmed, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(input.kind, cleanName(input.name, 'The option name', 40), input.priceFils, cleanColor(input.color), input.temperature ?? 'both',
          input.usesMilk ? 1 : 0, input.prepSeconds ?? 0, input.available === false ? 0 : 1, input.unconfirmed ? 1 : 0, max + 1).lastInsertRowid,
    )
  })
  publishMenuChanged()
  return id
}

export function updateBuilderOption(id: number, patch: Partial<Omit<BuilderInput, 'kind'>>): void {
  const row = db.prepare('SELECT * FROM builder_options WHERE id = ?').get(id) as
    | { name: string; price_fils: number; color: string | null; temperature: string; uses_milk: number; prep_seconds: number; available: number; unconfirmed: number }
    | undefined
  if (!row) throw new OrderError('Option not found.', 'not_found', 404)
  const priceChanged = patch.priceFils != null && patch.priceFils !== row.price_fils
  db.prepare(
    `UPDATE builder_options SET name = ?, price_fils = ?, color = ?, temperature = ?, uses_milk = ?, prep_seconds = ?, available = ?, unconfirmed = ? WHERE id = ?`,
  ).run(
    patch.name != null ? cleanName(patch.name, 'The option name', 40) : row.name,
    patch.priceFils ?? row.price_fils,
    patch.color !== undefined ? cleanColor(patch.color) : row.color,
    patch.temperature ?? row.temperature,
    (patch.usesMilk ?? row.uses_milk === 1) ? 1 : 0,
    patch.prepSeconds ?? row.prep_seconds,
    (patch.available ?? row.available === 1) ? 1 : 0,
    patch.unconfirmed != null ? (patch.unconfirmed ? 1 : 0) : priceChanged ? 0 : row.unconfirmed,
    id,
  )
  publishMenuChanged()
}

export function deleteBuilderOption(id: number): void {
  const info = db.prepare('DELETE FROM builder_options WHERE id = ?').run(id)
  if (info.changes === 0) throw new OrderError('Option not found.', 'not_found', 404)
  publishMenuChanged()
}

/* ---------- Summit Box ---------- */

export function setSummitBox(prices: SummitBoxPrice[]): void {
  if (prices.length === 0 || prices.length > 4) throw new OrderError('Offer between one and four Summit Box sizes.', 'invalid_request')
  if (new Set(prices.map((p) => p.size)).size !== prices.length) throw new OrderError('Each Summit Box size can only be listed once.', 'invalid_request')
  saveSettings({ summitBox: [...prices].sort((a, b) => a.size - b.size) })
  publishMenuChanged()
}
