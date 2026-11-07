import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { config } from './config'

mkdirSync(dirname(config.databasePath), { recursive: true })

export const db = new Database(config.databasePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')

/**
 * Schema. All money is integer fils. All timestamps are ISO 8601 UTC strings.
 *
 * Orders keep a snapshot of each item's name and price (order_items), so editing or deleting a menu
 * item later never rewrites history. Everything here is idempotent: it is safe to run on every start,
 * and new tables or columns are added to existing databases without touching their data.
 */
const ORDERS_DDL = (name: string) => `
CREATE TABLE IF NOT EXISTS ${name} (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  business_date   TEXT NOT NULL,
  number          INTEGER NOT NULL,
  user_id         INTEGER NOT NULL REFERENCES users (id),
  customer_name   TEXT NOT NULL,
  fulfilment      TEXT NOT NULL CHECK (fulfilment IN ('takeaway', 'dinein')),
  table_number    TEXT,
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('card', 'cash')),
  -- unpaid | paid | refunded
  payment_status  TEXT NOT NULL,
  -- awaiting_payment | scheduled | queued | preparing | ready | collected | cancelled
  status          TEXT NOT NULL,
  subtotal_fils   INTEGER NOT NULL DEFAULT 0,
  total_fils      INTEGER NOT NULL CHECK (total_fils >= 0),
  code            TEXT,
  code_fils       INTEGER NOT NULL DEFAULT 0,
  reward_id       TEXT,
  reward_points   INTEGER NOT NULL DEFAULT 0,
  reward_fils     INTEGER NOT NULL DEFAULT 0,
  pass_units      INTEGER NOT NULL DEFAULT 0,
  pass_fils       INTEGER NOT NULL DEFAULT 0,
  prep_seconds    INTEGER NOT NULL CHECK (prep_seconds >= 0),
  created_at      TEXT NOT NULL,
  confirmed_at    TEXT,
  -- Where the order sits in the queue: confirmed time for ASAP orders, due-to-start time for pre-orders.
  queue_at        TEXT,
  pickup_at       TEXT,
  due_at          TEXT,
  started_at      TEXT,
  ready_at        TEXT,
  collected_at    TEXT,
  cancelled_at    TEXT,
  cancel_reason   TEXT,
  refunded        INTEGER NOT NULL DEFAULT 0,
  was_late        INTEGER NOT NULL DEFAULT 0,
  points_awarded  INTEGER NOT NULL DEFAULT 0,
  rating          INTEGER,
  rating_comment  TEXT,
  rated_at        TEXT,
  pos_order_id    TEXT,
  receipt_id      TEXT,
  is_seed         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (business_date, number)
)`

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub  TEXT UNIQUE,
  email       TEXT,
  name        TEXT NOT NULL,
  first_name  TEXT NOT NULL,
  picture_url TEXT,
  is_demo     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'barista')),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('customer', 'staff')),
  principal_id INTEGER NOT NULL,
  expires_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id       INTEGER NOT NULL REFERENCES categories (id),
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  price_fils        INTEGER NOT NULL CHECK (price_fils >= 0),
  price_unconfirmed INTEGER NOT NULL DEFAULT 0,
  temperature       TEXT NOT NULL CHECK (temperature IN ('hot', 'iced', 'both', 'none')),
  caffeine_free     INTEGER NOT NULL DEFAULT 0,
  prep_seconds      INTEGER NOT NULL CHECK (prep_seconds > 0),
  sold_out          INTEGER NOT NULL DEFAULT 0,
  hidden            INTEGER NOT NULL DEFAULT 0,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  tags              TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_items_category ON items (category_id, sort_order);

CREATE TABLE IF NOT EXISTS option_groups (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  key          TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('single', 'multi')),
  required     INTEGER NOT NULL DEFAULT 0,
  show_default INTEGER NOT NULL DEFAULT 1,
  inline_label INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS options (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id          INTEGER NOT NULL REFERENCES option_groups (id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  price_delta_fils  INTEGER NOT NULL DEFAULT 0,
  price_unconfirmed INTEGER NOT NULL DEFAULT 0,
  is_default        INTEGER NOT NULL DEFAULT 0,
  sort_order        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_options_group ON options (group_id, sort_order);

CREATE TABLE IF NOT EXISTS item_option_groups (
  item_id    INTEGER NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  group_id   INTEGER NOT NULL REFERENCES option_groups (id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, group_id)
);

${ORDERS_DDL('orders')};
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  item_id          INTEGER,
  name             TEXT NOT NULL,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_fils  INTEGER NOT NULL CHECK (unit_price_fils >= 0),
  prep_seconds     INTEGER NOT NULL,
  modifiers        TEXT NOT NULL DEFAULT '[]',
  note             TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

CREATE TABLE IF NOT EXISTS order_events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  status   TEXT NOT NULL,
  actor    TEXT NOT NULL,
  at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events (order_id);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users (id),
  delta      INTEGER NOT NULL,
  -- earn | redeem | refund | adjust
  kind       TEXT NOT NULL,
  reason     TEXT NOT NULL,
  order_id   INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON loyalty_ledger (user_id, id);

CREATE TABLE IF NOT EXISTS promo_drink (
  id       INTEGER PRIMARY KEY CHECK (id = 1),
  item_id  INTEGER,
  headline TEXT NOT NULL,
  copy     TEXT NOT NULL DEFAULT '',
  image    TEXT,
  ends_at  TEXT,
  active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS promos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  image      TEXT,
  item_id    INTEGER,
  active     INTEGER NOT NULL DEFAULT 1,
  starts_at  TEXT,
  ends_at    TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_sample  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS discount_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  kind       TEXT NOT NULL CHECK (kind IN ('percent', 'fixed')),
  value      INTEGER NOT NULL CHECK (value > 0),
  starts_at  TEXT,
  ends_at    TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  max_uses   INTEGER,
  uses       INTEGER NOT NULL DEFAULT 0,
  is_sample  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS builder_options (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  -- base | flavour | shot | topping | sweetness
  kind         TEXT NOT NULL CHECK (kind IN ('base', 'flavour', 'shot', 'topping', 'sweetness')),
  name         TEXT NOT NULL,
  -- For a base this is the starting price of the drink; for everything else it is the add-on price.
  price_fils   INTEGER NOT NULL DEFAULT 0,
  color        TEXT,
  temperature  TEXT NOT NULL DEFAULT 'both' CHECK (temperature IN ('hot', 'iced', 'both')),
  uses_milk    INTEGER NOT NULL DEFAULT 0,
  prep_seconds INTEGER NOT NULL DEFAULT 0,
  available    INTEGER NOT NULL DEFAULT 1,
  unconfirmed  INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS creations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users (id),
  name          TEXT NOT NULL,
  config        TEXT NOT NULL,
  favourite     INTEGER NOT NULL DEFAULT 0,
  -- none | pending | approved | rejected
  submit_status TEXT NOT NULL DEFAULT 'none',
  reject_reason TEXT,
  submitted_at  TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_creations_user ON creations (user_id);

CREATE TABLE IF NOT EXISTS favourites (
  user_id    INTEGER NOT NULL REFERENCES users (id),
  item_id    INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL CHECK (kind IN ('event', 'post')),
  title         TEXT NOT NULL,
  club          TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  starts_at     TEXT,
  place         TEXT,
  cover_image   TEXT,
  -- pending | approved | rejected | unpublished
  status        TEXT NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  author_user_id INTEGER,
  author_name   TEXT NOT NULL,
  manage_token  TEXT,
  is_sample     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  decided_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts (status, starts_at);

CREATE TABLE IF NOT EXISTS post_interest (
  post_id    INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  viewer_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, viewer_key)
);

CREATE TABLE IF NOT EXISTS passes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users (id),
  size           INTEGER NOT NULL,
  remaining      INTEGER NOT NULL,
  price_fils     INTEGER NOT NULL,
  -- active | used | void
  status         TEXT NOT NULL DEFAULT 'active',
  payment_method TEXT NOT NULL DEFAULT 'card',
  receipt_id     TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_passes_user ON passes (user_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users (id),
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`

function hasColumn(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return rows.some((r) => r.name === column)
}

/** Add a column to an existing table if an older database does not have it yet. */
function ensureColumn(table: string, column: string, ddl: string): void {
  if (!hasColumn(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
}

/**
 * Databases from the first build had CHECK constraints on order status that cannot allow the new
 * "scheduled" and "cancelled" states. SQLite cannot change a CHECK in place, so the table is rebuilt
 * with its rows copied across.
 */
function rebuildLegacyOrders(): void {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'orders'`).get() as { sql: string } | undefined
  if (!row || !/CHECK \(status IN/.test(row.sql)) return

  const oldColumns = (db.prepare('PRAGMA table_info(orders)').all() as { name: string }[]).map((c) => c.name)
  db.pragma('foreign_keys = OFF')
  try {
    db.transaction(() => {
      db.exec(ORDERS_DDL('orders_rebuild'))
      const shared = oldColumns.join(', ')
      db.exec(`INSERT INTO orders_rebuild (${shared}) SELECT ${shared} FROM orders`)
      db.exec('DROP TABLE orders')
      db.exec('ALTER TABLE orders_rebuild RENAME TO orders')
      db.exec(`UPDATE orders SET subtotal_fils = total_fils WHERE subtotal_fils = 0`)
      db.exec(`UPDATE orders SET queue_at = confirmed_at WHERE queue_at IS NULL`)
    })()
  } finally {
    db.pragma('foreign_keys = ON')
  }
}

export function migrate(): void {
  // Order matters: make sure the settings/users tables exist, fix a legacy orders table, then the rest.
  db.exec(SCHEMA)
  rebuildLegacyOrders()
  db.exec(SCHEMA)

  ensureColumn('items', 'image', 'TEXT')
  ensureColumn('items', 'kind', `TEXT NOT NULL DEFAULT 'drink'`)
  ensureColumn('order_items', 'selections', 'TEXT')
  ensureColumn('order_items', 'creation', 'TEXT')
  ensureColumn('order_items', 'kind', `TEXT NOT NULL DEFAULT 'drink'`)
  ensureColumn('order_items', 'category_slug', 'TEXT')
}

/** Run a function inside one SQLite transaction. Rolls back if it throws. */
export function inTransaction<T>(fn: () => T): T {
  return db.transaction(fn)()
}
