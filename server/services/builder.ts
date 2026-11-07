import {
  cleanCreationName,
  creationKey,
  describeCreation,
  suggestName,
  MAX_EXTRA_SHOTS,
  type BuilderData,
  type BuilderKind,
  type BuilderMilk,
  type BuilderOptionView,
  type CommunityCreation,
  type SavedCreation,
  type SubmitStatus,
} from '../../shared/builder'
import type { CreationConfig, OrderLineInput } from '../../shared/types'
import { db } from '../db'
import { cleanNote, OrderError, type CreationPricer, type PricedLine } from '../domain/pricing'

/** The most creations one customer can keep, and the most they can have waiting for review at once. */
const MAX_SAVED = 30
const MAX_PENDING = 3

interface OptionRow {
  id: number
  kind: BuilderKind
  name: string
  price_fils: number
  color: string | null
  temperature: 'hot' | 'iced' | 'both'
  uses_milk: number
  prep_seconds: number
}

/** What the builder offers right now, read fresh so a change in the dashboard shows up straight away. */
export function loadBuilderData(): BuilderData {
  const rows = db
    .prepare('SELECT id, kind, name, price_fils, color, temperature, uses_milk, prep_seconds FROM builder_options WHERE available = 1 ORDER BY kind, sort_order, id')
    .all() as OptionRow[]
  const view = (r: OptionRow): BuilderOptionView => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    priceFils: r.price_fils,
    color: r.color,
    temperature: r.temperature,
    usesMilk: r.uses_milk === 1,
    prepSeconds: r.prep_seconds,
  })
  const of = (kind: BuilderKind) => rows.filter((r) => r.kind === kind).map(view)

  const milks = db
    .prepare(
      `SELECT o.id, o.name, o.price_delta_fils, o.is_default FROM options o
       JOIN option_groups g ON g.id = o.group_id WHERE g.key = 'milk' ORDER BY o.sort_order, o.id`,
    )
    .all() as { id: number; name: string; price_delta_fils: number; is_default: number }[]

  return {
    bases: of('base'),
    flavours: of('flavour'),
    sweetness: of('sweetness'),
    toppings: of('topping'),
    shot: of('shot')[0] ?? null,
    milks: milks.map((m): BuilderMilk => ({ id: m.id, name: m.name, priceDeltaFils: m.price_delta_fils, isDefault: m.is_default === 1 })),
    maxExtraShots: MAX_EXTRA_SHOTS,
  }
}

/**
 * Prices a creation line for an order. The options are read once per order and checked again here, so a
 * recipe is always priced from the team's current prices, whatever the browser says.
 */
export function makeCreationPricer(): CreationPricer {
  let data: BuilderData | null = null
  return (input: OrderLineInput): PricedLine => {
    const creation = input.creation
    if (!creation) throw new OrderError('That line has no recipe.', 'invalid_request')
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 20) {
      throw new OrderError('Quantity must be between 1 and 20.', 'invalid_quantity')
    }
    const name = cleanCreationName(creation.name)
    if (!name) throw new OrderError('Give your creation a name.', 'invalid_creation')
    data ??= loadBuilderData()
    const described = describeCreation(creation, data)
    if (!described.ok) throw new OrderError(`${name}: ${described.message}`, 'invalid_creation', 409)
    return {
      itemId: null,
      name,
      quantity: input.quantity,
      unitPriceFils: described.unitPriceFils,
      lineTotalFils: described.unitPriceFils * input.quantity,
      prepSeconds: described.prepSeconds,
      modifiers: described.modifiers,
      note: cleanNote(input.note),
      kind: 'drink',
      categorySlug: 'creations',
      selections: null,
      creation: JSON.stringify({ ...described.config, name }),
    }
  }
}

/* ---------- Saved creations ---------- */

interface CreationRow {
  id: number
  user_id: number
  name: string
  config: string
  favourite: number
  submit_status: SubmitStatus
  reject_reason: string | null
  submitted_at: string | null
  decided_at: string | null
  is_sample: number
  created_at: string
  author?: string
}

function parseConfig(text: string): CreationConfig | null {
  try {
    const value = JSON.parse(text) as CreationConfig
    return value && typeof value === 'object' && typeof value.baseId === 'number' ? value : null
  } catch {
    return null
  }
}

function toSaved(row: CreationRow, data: BuilderData): SavedCreation | null {
  const config = parseConfig(row.config)
  if (!config) return null
  const described = describeCreation(config, data)
  return {
    id: row.id,
    name: row.name,
    config,
    submitStatus: row.submit_status,
    rejectReason: row.reject_reason,
    createdAt: row.created_at,
    priceFils: described.ok ? described.unitPriceFils : null,
    modifiers: described.ok ? described.modifiers : [],
  }
}

export function listSaved(userId: number): SavedCreation[] {
  const data = loadBuilderData()
  const rows = db.prepare('SELECT * FROM creations WHERE user_id = ? AND favourite = 1 ORDER BY id DESC').all(userId) as CreationRow[]
  return rows.flatMap((r) => toSaved(r, data) ?? [])
}

/** Saving a creation is the same as adding it to favourites. Saving the same recipe twice returns the first. */
export function saveCreation(userId: number, input: { name: string; config: CreationConfig }): SavedCreation {
  const data = loadBuilderData()
  const described = describeCreation(input.config, data)
  if (!described.ok) throw new OrderError(described.message, 'invalid_creation', 409)
  const name = cleanCreationName(input.name) || suggestName(described)

  const existing = db.prepare('SELECT * FROM creations WHERE user_id = ?').all(userId) as CreationRow[]
  const key = creationKey({ ...described.config, name })
  const same = existing.find((r) => {
    const config = parseConfig(r.config)
    return config && r.name === name && creationKey({ ...config, name }) === key
  })
  if (same) {
    if (same.favourite !== 1) db.prepare('UPDATE creations SET favourite = 1 WHERE id = ?').run(same.id)
    return toSaved({ ...same, favourite: 1 }, data)!
  }
  if (existing.filter((r) => r.favourite === 1).length >= MAX_SAVED) {
    throw new OrderError(`You can keep up to ${MAX_SAVED} creations. Remove one to save another.`, 'too_many_creations', 409)
  }
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO creations (user_id, name, config, favourite, submit_status, created_at) VALUES (?, ?, ?, 1, 'none', ?)`)
    .run(userId, name, JSON.stringify(described.config), new Date().toISOString())
  const row = db.prepare('SELECT * FROM creations WHERE id = ?').get(Number(lastInsertRowid)) as CreationRow
  return toSaved(row, data)!
}

/** Removing a creation also takes it off the community board if it was shared. */
export function deleteCreation(userId: number, id: number): void {
  const info = db.prepare('DELETE FROM creations WHERE id = ? AND user_id = ?').run(id, userId)
  if (info.changes === 0) throw new OrderError('Creation not found.', 'not_found', 404)
}

export function submitCreation(userId: number, id: number): SavedCreation {
  const row = db.prepare('SELECT * FROM creations WHERE id = ? AND user_id = ?').get(id, userId) as CreationRow | undefined
  if (!row) throw new OrderError('Creation not found.', 'not_found', 404)
  if (row.submit_status === 'pending') throw new OrderError('That one is already waiting for review.', 'already_submitted', 409)
  if (row.submit_status === 'approved') throw new OrderError("That one is already on the community board.", 'already_submitted', 409)
  const data = loadBuilderData()
  const config = parseConfig(row.config)
  if (!config || !describeCreation(config, data).ok) throw new OrderError("That recipe can't be made right now, so it can't be shared.", 'invalid_creation', 409)
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM creations WHERE user_id = ? AND submit_status = 'pending'`).get(userId) as { n: number }
  if (n >= MAX_PENDING) throw new OrderError(`You have ${n} creations waiting for review. Wait for those first.`, 'too_many_pending', 429)
  db.prepare(`UPDATE creations SET submit_status = 'pending', reject_reason = NULL, submitted_at = ? WHERE id = ?`).run(new Date().toISOString(), id)
  return toSaved({ ...row, submit_status: 'pending', reject_reason: null }, data)!
}

/* ---------- Community board ---------- */

/** Approved creations, newest first. A creation that can no longer be made is left off. */
export function listCommunity(limit = 12): CommunityCreation[] {
  const data = loadBuilderData()
  const rows = db
    .prepare(
      `SELECT c.*, u.first_name AS author FROM creations c JOIN users u ON u.id = c.user_id
       WHERE c.submit_status = 'approved' ORDER BY c.decided_at DESC, c.id DESC`,
    )
    .all() as CreationRow[]
  const out: CommunityCreation[] = []
  for (const row of rows) {
    const config = parseConfig(row.config)
    const described = config ? describeCreation(config, data) : null
    if (!config || !described?.ok) continue
    out.push({
      id: row.id,
      name: row.name,
      authorFirstName: row.author ?? 'A student',
      config,
      priceFils: described.unitPriceFils,
      modifiers: described.modifiers,
      isSample: row.is_sample === 1,
    })
    if (out.length === limit) break
  }
  return out
}

/* ---------- Moderation ---------- */

export interface ModerationCreation {
  id: number
  name: string
  authorName: string
  config: CreationConfig
  priceFils: number | null
  modifiers: string[]
  status: SubmitStatus
  rejectReason: string | null
  submittedAt: string | null
  decidedAt: string | null
  isSample: boolean
}

export function listForModeration(): { pending: ModerationCreation[]; decided: ModerationCreation[] } {
  const data = loadBuilderData()
  const rows = db
    .prepare(
      `SELECT c.*, u.first_name AS author FROM creations c JOIN users u ON u.id = c.user_id
       WHERE c.submit_status IN ('pending', 'approved', 'rejected') ORDER BY c.submitted_at DESC, c.id DESC`,
    )
    .all() as CreationRow[]
  const all = rows.flatMap((row): ModerationCreation[] => {
    const config = parseConfig(row.config)
    if (!config) return []
    const described = describeCreation(config, data)
    return [
      {
        id: row.id,
        name: row.name,
        authorName: row.author ?? 'A student',
        config,
        priceFils: described.ok ? described.unitPriceFils : null,
        modifiers: described.ok ? described.modifiers : [],
        status: row.submit_status,
        rejectReason: row.reject_reason,
        submittedAt: row.submitted_at,
        decidedAt: row.decided_at,
        isSample: row.is_sample === 1,
      },
    ]
  })
  return {
    // The oldest waiting creation is first, so the queue is worked in order.
    pending: all.filter((c) => c.status === 'pending').reverse(),
    decided: all.filter((c) => c.status !== 'pending').slice(0, 30),
  }
}

function getRow(id: number): CreationRow {
  const row = db.prepare('SELECT * FROM creations WHERE id = ?').get(id) as CreationRow | undefined
  if (!row) throw new OrderError('Creation not found.', 'not_found', 404)
  return row
}

/** Puts a pending creation on the board. The name can be fixed first. */
export function approveCreation(id: number, rename?: string): void {
  const row = getRow(id)
  if (row.submit_status !== 'pending') throw new OrderError('Only a creation that is waiting for review can be approved.', 'wrong_state', 409)
  const config = parseConfig(row.config)
  if (!config || !describeCreation(config, loadBuilderData()).ok) {
    throw new OrderError("That recipe uses something that is no longer on offer, so it can't go on the board.", 'invalid_creation', 409)
  }
  const name = rename === undefined ? row.name : cleanCreationName(rename)
  if (!name) throw new OrderError('The name cannot be empty.', 'invalid_request')
  db.prepare(`UPDATE creations SET submit_status = 'approved', name = ?, reject_reason = NULL, decided_at = ? WHERE id = ?`).run(name, new Date().toISOString(), id)
}

/** The reason is shown to the person who shared it. */
export function rejectCreation(id: number, reason: string): void {
  const row = getRow(id)
  if (row.submit_status !== 'pending') throw new OrderError('Only a creation that is waiting for review can be turned down.', 'wrong_state', 409)
  const text = reason.replace(/\s+/g, ' ').trim().slice(0, 160)
  if (!text) throw new OrderError('Add a reason so they know why.', 'invalid_request')
  db.prepare(`UPDATE creations SET submit_status = 'rejected', reject_reason = ?, decided_at = ? WHERE id = ?`).run(text, new Date().toISOString(), id)
}

/** Takes a creation off the board. The customer keeps it in their favourites. */
export function unpublishCreation(id: number): void {
  const row = getRow(id)
  if (row.submit_status !== 'approved') throw new OrderError('That creation is not on the board.', 'wrong_state', 409)
  db.prepare(`UPDATE creations SET submit_status = 'none', decided_at = ? WHERE id = ?`).run(new Date().toISOString(), id)
}

/* ---------- Favourite menu items ---------- */

export function favouriteItemIds(userId: number): number[] {
  const rows = db
    .prepare(`SELECT f.item_id FROM favourites f JOIN items i ON i.id = f.item_id WHERE f.user_id = ? AND i.hidden = 0 ORDER BY f.created_at DESC`)
    .all(userId) as { item_id: number }[]
  return rows.map((r) => r.item_id)
}

export function setFavouriteItem(userId: number, itemId: number, on: boolean): void {
  if (on) {
    const exists = db.prepare('SELECT 1 FROM items WHERE id = ? AND hidden = 0').get(itemId)
    if (!exists) throw new OrderError('That item is not on the menu.', 'not_found', 404)
    db.prepare('INSERT OR IGNORE INTO favourites (user_id, item_id, created_at) VALUES (?, ?, ?)').run(userId, itemId, new Date().toISOString())
  } else {
    db.prepare('DELETE FROM favourites WHERE user_id = ? AND item_id = ?').run(userId, itemId)
  }
}
