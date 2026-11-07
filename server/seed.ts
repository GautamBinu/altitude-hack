import bcrypt from 'bcryptjs'
import { config } from './config'
import { db, inTransaction, migrate } from './db'
import {
  DEFAULT_SETTINGS,
  GROUP_ORDER,
  SEED_CATEGORIES,
  SEED_GROUPS,
  type SeedItem,
} from './seed-data'

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const now = () => new Date().toISOString()

function wipe(): void {
  const tables = [
    'order_events',
    'order_items',
    'orders',
    'sessions',
    'item_option_groups',
    'options',
    'option_groups',
    'items',
    'categories',
    'users',
    'staff',
    'settings',
  ]
  for (const table of tables) db.exec(`DELETE FROM ${table}`)
  db.exec(`DELETE FROM sqlite_sequence`)
}

function seedSettings(): void {
  const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insert.run(key, JSON.stringify(value))
  }
}

function seedStaff(): void {
  const insert = db.prepare(
    'INSERT INTO staff (username, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, ?)',
  )
  insert.run('admin', bcrypt.hashSync(config.seedAdminPassword, 10), 'Admin', 'admin', now())
  insert.run('barista', bcrypt.hashSync(config.seedBaristaPassword, 10), 'Barista', 'barista', now())
}

function seedMenu(): void {
  const insertGroup = db.prepare(
    `INSERT INTO option_groups (key, name, kind, required, show_default, inline_label, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertOption = db.prepare(
    `INSERT INTO options (group_id, name, price_delta_fils, price_unconfirmed, is_default, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  const groupIds = new Map<string, number>()
  for (const group of SEED_GROUPS) {
    const order = GROUP_ORDER.indexOf(group.key)
    const { lastInsertRowid } = insertGroup.run(
      group.key,
      group.name,
      group.kind,
      group.required ? 1 : 0,
      group.showDefault ? 1 : 0,
      group.inlineLabel ? 1 : 0,
      order,
    )
    const groupId = Number(lastInsertRowid)
    groupIds.set(group.key, groupId)
    group.options.forEach((option, index) => {
      insertOption.run(
        groupId,
        option.name,
        option.delta ?? 0,
        option.unconfirmed ? 1 : 0,
        option.isDefault ? 1 : 0,
        index,
      )
    })
  }

  const insertCategory = db.prepare('INSERT INTO categories (slug, name, sort_order) VALUES (?, ?, ?)')
  const insertItem = db.prepare(
    `INSERT INTO items (category_id, slug, name, description, price_fils, price_unconfirmed, temperature,
                        caffeine_free, prep_seconds, sort_order, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const linkGroup = db.prepare('INSERT INTO item_option_groups (item_id, group_id, sort_order) VALUES (?, ?, ?)')

  const groupKeysFor = (item: SeedItem): string[] => {
    const keys: string[] = []
    if (item.temp === 'both') keys.push('temperature')
    keys.push(...(item.groups ?? []))
    if (item.milk) keys.push('milk')
    return keys.sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
  }

  SEED_CATEGORIES.forEach((category, categoryIndex) => {
    const { lastInsertRowid } = insertCategory.run(category.slug, category.name, categoryIndex)
    const categoryId = Number(lastInsertRowid)
    category.items.forEach((item, itemIndex) => {
      const tags = [
        ...(item.tags ?? []),
        item.caffeineFree ? 'caffeine-free' : 'caffeinated',
        ...(item.temp === 'both' ? ['hot', 'iced'] : item.temp === 'none' ? [] : [item.temp]),
      ]
      const res = insertItem.run(
        categoryId,
        slugify(item.name),
        item.name,
        item.description,
        item.price,
        item.unconfirmed ? 1 : 0,
        item.temp,
        item.caffeineFree ? 1 : 0,
        item.prep,
        itemIndex,
        JSON.stringify(tags),
      )
      const itemId = Number(res.lastInsertRowid)
      groupKeysFor(item).forEach((key, order) => {
        const groupId = groupIds.get(key)
        if (!groupId) throw new Error(`Seed item "${item.name}" references unknown option group "${key}"`)
        linkGroup.run(itemId, groupId, order)
      })
    })
  })
}

export function seedDatabase(options: { reset?: boolean } = {}): void {
  migrate()
  inTransaction(() => {
    if (options.reset) wipe()
    seedSettings()
    seedStaff()
    seedMenu()
  })
}

/** Seed on first start only. Existing data is never touched. */
export function ensureSeeded(): boolean {
  migrate()
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM categories').get() as { count: number }
  if (count > 0) return false
  seedDatabase()
  return true
}
