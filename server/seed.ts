import bcrypt from 'bcryptjs'
import { config } from './config'
import { db, inTransaction, migrate } from './db'
import { seedHistory, seedStudents } from './seed-history'
import {
  DEFAULT_SETTINGS,
  GROUP_ORDER,
  SEED_CATEGORIES,
  SEED_GROUPS,
  type SeedItem,
} from './seed-data'
import { SEED_BUILDER, SEED_CODE, SEED_POSTS, SEED_PROMOS } from './seed-content'
import { DEFAULT_REWARDS, DEFAULT_TIERS } from '../shared/loyalty'
import { addDays, businessDate, getSettings, zonedTimeToUtc } from './services/settings'
import { slugify } from './slug'

export { slugify }

const now = () => new Date().toISOString()

function wipe(): void {
  const tables = [
    'push_subscriptions',
    'passes',
    'post_interest',
    'posts',
    'favourites',
    'creations',
    'builder_options',
    'discount_codes',
    'promos',
    'promo_drink',
    'loyalty_ledger',
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

const isDone = (key: string): boolean => !!db.prepare('SELECT 1 FROM settings WHERE key = ?').get(`seed:${key}`)
const markDone = (key: string): void => {
  db.prepare(`INSERT INTO settings (key, value) VALUES (?, 'true') ON CONFLICT (key) DO NOTHING`).run(`seed:${key}`)
}

/** Add any setting that is missing. Never overwrites a value the team has changed. */
function seedSettings(): void {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) insert.run(key, JSON.stringify(value))
  insert.run('loyalty', JSON.stringify({ tiers: DEFAULT_TIERS, rewards: DEFAULT_REWARDS }))

  // The first build stored opening hours in a different shape that nothing read. Replace it.
  const hours = db.prepare(`SELECT value FROM settings WHERE key = 'openingHours'`).get() as { value: string } | undefined
  if (hours) {
    try {
      const parsed = JSON.parse(hours.value) as Record<string, unknown>
      if (!('mon' in parsed)) {
        db.prepare(`UPDATE settings SET value = ? WHERE key = 'openingHours'`).run(JSON.stringify(DEFAULT_SETTINGS.openingHours))
      }
    } catch {
      db.prepare(`UPDATE settings SET value = ? WHERE key = 'openingHours'`).run(JSON.stringify(DEFAULT_SETTINGS.openingHours))
    }
  }
}

function seedStaff(): void {
  const count = (db.prepare('SELECT COUNT(*) AS n FROM staff').get() as { n: number }).n
  if (count > 0) return
  const insert = db.prepare(
    'INSERT INTO staff (username, password_hash, display_name, role, created_at) VALUES (?, ?, ?, ?, ?)',
  )
  insert.run('admin', bcrypt.hashSync(config.seedAdminPassword, 10), 'Admin', 'admin', now())
  insert.run('barista', bcrypt.hashSync(config.seedBaristaPassword, 10), 'Barista', 'barista', now())
}

/** Inserts whatever menu data is missing, by slug or key. Existing items and edits are left alone. */
function seedMenu(): void {
  const groupIds = new Map<string, number>()
  const findGroup = db.prepare('SELECT id FROM option_groups WHERE key = ?')
  const insertGroup = db.prepare(
    `INSERT INTO option_groups (key, name, kind, required, show_default, inline_label, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertOption = db.prepare(
    `INSERT INTO options (group_id, name, price_delta_fils, price_unconfirmed, is_default, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  for (const group of SEED_GROUPS) {
    const existing = findGroup.get(group.key) as { id: number } | undefined
    if (existing) {
      groupIds.set(group.key, existing.id)
      continue
    }
    const { lastInsertRowid } = insertGroup.run(
      group.key,
      group.name,
      group.kind,
      group.required ? 1 : 0,
      group.showDefault ? 1 : 0,
      group.inlineLabel ? 1 : 0,
      GROUP_ORDER.indexOf(group.key),
    )
    const groupId = Number(lastInsertRowid)
    groupIds.set(group.key, groupId)
    group.options.forEach((option, index) => {
      insertOption.run(groupId, option.name, option.delta ?? 0, option.unconfirmed ? 1 : 0, option.isDefault ? 1 : 0, index)
    })
  }

  const findCategory = db.prepare('SELECT id FROM categories WHERE slug = ?')
  const insertCategory = db.prepare('INSERT INTO categories (slug, name, sort_order) VALUES (?, ?, ?)')
  const findItem = db.prepare('SELECT id FROM items WHERE slug = ?')
  const insertItem = db.prepare(
    `INSERT INTO items (category_id, slug, name, description, price_fils, price_unconfirmed, temperature,
                        caffeine_free, prep_seconds, sort_order, tags, kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const linkGroup = db.prepare('INSERT OR IGNORE INTO item_option_groups (item_id, group_id, sort_order) VALUES (?, ?, ?)')

  const groupKeysFor = (item: SeedItem): string[] => {
    const keys: string[] = []
    if (item.temp === 'both') keys.push('temperature')
    keys.push(...(item.groups ?? []))
    if (item.milk) keys.push('milk')
    return keys.sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
  }

  SEED_CATEGORIES.forEach((category, categoryIndex) => {
    let categoryId = (findCategory.get(category.slug) as { id: number } | undefined)?.id
    if (!categoryId) categoryId = Number(insertCategory.run(category.slug, category.name, categoryIndex).lastInsertRowid)

    category.items.forEach((item, itemIndex) => {
      const slug = slugify(item.name)
      if (findItem.get(slug)) return
      const tags = [
        ...(item.tags ?? []),
        item.caffeineFree ? 'caffeine-free' : 'caffeinated',
        ...(item.temp === 'both' ? ['hot', 'iced'] : item.temp === 'none' ? [] : [item.temp]),
      ]
      const res = insertItem.run(
        categoryId,
        slug,
        item.name,
        item.description,
        item.price,
        item.unconfirmed ? 1 : 0,
        item.temp,
        item.caffeineFree ? 1 : 0,
        item.prep,
        itemIndex,
        JSON.stringify(tags),
        item.kind ?? category.kind,
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

/** Menus from the first build did not know drink from food. */
function fixItemKinds(): void {
  const update = db.prepare('UPDATE items SET kind = ? WHERE slug = ?')
  for (const category of SEED_CATEGORIES) {
    for (const item of category.items) update.run(item.kind ?? category.kind, slugify(item.name))
  }
}

function seedBuilder(): void {
  const insert = db.prepare(
    `INSERT INTO builder_options (kind, name, price_fils, color, temperature, uses_milk, prep_seconds, unconfirmed, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const counters = new Map<string, number>()
  for (const option of SEED_BUILDER) {
    const order = counters.get(option.kind) ?? 0
    counters.set(option.kind, order + 1)
    insert.run(
      option.kind,
      option.name,
      option.price,
      option.color ?? null,
      option.temperature ?? 'both',
      option.usesMilk ? 1 : 0,
      option.prep ?? 0,
      option.unconfirmed ? 1 : 0,
      order,
    )
  }
}

function seedPromos(): void {
  const tz = getSettings().timezone
  const today = businessDate(new Date(), tz)
  const itemId = (slug: string): number | null => (db.prepare('SELECT id FROM items WHERE slug = ?').get(slug) as { id: number } | undefined)?.id ?? null

  // The kickoff deck's example Drink of the Month.
  const cloud = itemId('caramel-cloud-latte')
  db.prepare(
    `INSERT OR IGNORE INTO promo_drink (id, item_id, headline, copy, image, ends_at, active)
     VALUES (1, ?, 'Caramel Cloud Latte', 'Try it before it''s gone.', NULL, ?, 1)`,
  ).run(cloud, zonedTimeToUtc(addDays(today, 21), '23:59', tz).toISOString())

  const insertPromo = db.prepare(
    `INSERT INTO promos (title, body, item_id, active, sort_order, is_sample) VALUES (?, ?, ?, 1, ?, 1)`,
  )
  SEED_PROMOS.forEach((promo, i) => insertPromo.run(promo.title, promo.body, promo.itemSlug ? itemId(promo.itemSlug) : null, i))

  db.prepare(
    `INSERT OR IGNORE INTO discount_codes (code, kind, value, active, is_sample, created_at) VALUES (?, ?, ?, 1, 1, ?)`,
  ).run(SEED_CODE.code, SEED_CODE.kind, SEED_CODE.value, now())
}

function seedEvents(): void {
  const tz = getSettings().timezone
  const today = businessDate(new Date(), tz)
  const insert = db.prepare(
    `INSERT INTO posts (kind, title, club, body, starts_at, place, cover_image, status, author_name, is_sample, created_at, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 1, ?, ?)`,
  )
  const interest = db.prepare('INSERT OR IGNORE INTO post_interest (post_id, viewer_key, created_at) VALUES (?, ?, ?)')
  SEED_POSTS.forEach((post, i) => {
    const startsAt =
      post.dayOffset != null && post.hour != null
        ? zonedTimeToUtc(addDays(today, post.dayOffset), `${String(post.hour).padStart(2, '0')}:00`, tz).toISOString()
        : null
    const created = new Date(Date.now() - (6 - i) * 86_400_000 / 2).toISOString()
    const { lastInsertRowid } = insert.run(
      post.kind, post.title, post.club, post.body, startsAt, post.place ?? null, post.status, post.author, created,
      post.status === 'approved' ? created : null,
    )
    if (post.status === 'approved') {
      const n = 4 + ((i * 7) % 22)
      for (let k = 0; k < n; k++) interest.run(Number(lastInsertRowid), `seed:${i}:${k}`, created)
    }
  })
}

/** The demo student arrives with a Summit Box they have already started on. */
function seedDemoPass(): void {
  const demo = db.prepare(`SELECT id FROM users WHERE google_sub = 'demo:student'`).get() as { id: number } | undefined
  if (!demo) return
  db.prepare(
    `INSERT INTO passes (user_id, size, remaining, price_fils, status, payment_method, receipt_id, created_at)
     VALUES (?, 6, 4, 17500, 'active', 'card', 'SEED-RCPT-PASS', ?)`,
  ).run(demo.id, new Date(Date.now() - 9 * 86_400_000).toISOString())
}

function runStep(key: string, fn: () => void): void {
  if (isDone(key)) return
  inTransaction(() => {
    fn()
    markDone(key)
  })
}

function seedAll(): void {
  seedSettings()
  seedStaff()
  runStep('menu', seedMenu)
  runStep('kinds', fixItemKinds)
  runStep('builder', seedBuilder)
  runStep('history', () => {
    seedHistory()
    seedDemoPass()
  })
  runStep('promos', seedPromos)
  runStep('events', seedEvents)
}

export function seedDatabase(options: { reset?: boolean } = {}): void {
  migrate()
  inTransaction(() => {
    if (options.reset) wipe()
  })
  seedAll()
}

/**
 * Runs on every start. A brand new database is seeded in full. An older database gets whatever it is
 * missing, step by step, without touching orders, accounts or anything the team has edited.
 */
export function ensureSeeded(): boolean {
  migrate()
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM categories').get() as { count: number }
  const fresh = count === 0
  seedAll()
  return fresh
}

export { seedStudents }
