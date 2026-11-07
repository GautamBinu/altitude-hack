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
 * Schema for the ordering loop. All money is integer fils. All timestamps are ISO 8601 UTC strings.
 * Orders keep a snapshot of each item's name and price (order_items), so editing the menu later never
 * rewrites history.
 */
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

CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  business_date  TEXT NOT NULL,
  number         INTEGER NOT NULL,
  user_id        INTEGER NOT NULL REFERENCES users (id),
  customer_name  TEXT NOT NULL,
  fulfilment     TEXT NOT NULL CHECK (fulfilment IN ('takeaway', 'dinein')),
  table_number   TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card', 'cash')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('unpaid', 'paid')),
  status         TEXT NOT NULL CHECK (status IN ('awaiting_payment', 'queued', 'preparing', 'ready', 'collected')),
  total_fils     INTEGER NOT NULL CHECK (total_fils >= 0),
  prep_seconds   INTEGER NOT NULL CHECK (prep_seconds >= 0),
  created_at     TEXT NOT NULL,
  confirmed_at   TEXT,
  started_at     TEXT,
  ready_at       TEXT,
  collected_at   TEXT,
  pos_order_id   TEXT,
  receipt_id     TEXT,
  UNIQUE (business_date, number)
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id, id DESC);

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
`

export function migrate(): void {
  db.exec(SCHEMA)
}

/** Run a function inside one SQLite transaction. Rolls back if it throws. */
export function inTransaction<T>(fn: () => T): T {
  return db.transaction(fn)()
}
