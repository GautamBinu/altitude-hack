import type { AdminBanner, AdminCode, AdminPromoDrink, AdminPromotions } from '../../shared/admin'
import { db } from '../db'
import type { DiscountCode } from '../domain/discounts'
import { OrderError } from '../domain/pricing'
import { publishMenuChanged } from '../realtime'
import { assertLocalImage } from './uploads'

/* Marketing's tools: the Drink of the Month, promo banners and discount codes. */

const iso = (value: string | null | undefined): string | null => {
  if (!value) return null
  const t = Date.parse(value)
  if (!Number.isFinite(t)) throw new OrderError('That date is not valid.', 'invalid_request')
  return new Date(t).toISOString()
}

const text = (value: string, label: string, max: number, required = true): string => {
  const v = value.replace(/\s+/g, ' ').trim()
  if (required && v.length === 0) throw new OrderError(`${label} can't be empty.`, 'invalid_request')
  if (v.length > max) throw new OrderError(`${label} can be up to ${max} characters.`, 'invalid_request')
  return v
}

export function getAdminPromotions(): AdminPromotions {
  const drink = db.prepare('SELECT item_id, headline, copy, image, ends_at, active FROM promo_drink WHERE id = 1').get() as
    | { item_id: number | null; headline: string; copy: string; image: string | null; ends_at: string | null; active: number }
    | undefined
  const banners = db.prepare('SELECT * FROM promos ORDER BY sort_order, id').all() as {
    id: number; title: string; body: string; image: string | null; item_id: number | null; active: number
    starts_at: string | null; ends_at: string | null; is_sample: number
  }[]
  const codes = db.prepare('SELECT * FROM discount_codes ORDER BY id DESC').all() as {
    id: number; code: string; kind: 'percent' | 'fixed'; value: number; starts_at: string | null; ends_at: string | null
    active: number; max_uses: number | null; uses: number; is_sample: number
  }[]
  return {
    drink: drink
      ? { itemId: drink.item_id, headline: drink.headline, copy: drink.copy, imageUrl: drink.image, endsAt: drink.ends_at, active: drink.active === 1 }
      : null,
    banners: banners.map<AdminBanner>((b) => ({
      id: b.id, title: b.title, body: b.body, imageUrl: b.image, itemId: b.item_id, active: b.active === 1,
      startsAt: b.starts_at, endsAt: b.ends_at, isSample: b.is_sample === 1,
    })),
    codes: codes.map<AdminCode>((c) => ({
      id: c.id, code: c.code, kind: c.kind, value: c.value, startsAt: c.starts_at, endsAt: c.ends_at,
      active: c.active === 1, maxUses: c.max_uses, uses: c.uses, isSample: c.is_sample === 1,
    })),
  }
}

/* ---------- Drink of the Month ---------- */

export function setPromoDrink(input: AdminPromoDrink): void {
  if (input.itemId != null && !db.prepare('SELECT 1 FROM items WHERE id = ?').get(input.itemId)) {
    throw new OrderError('Pick an item from the menu.', 'invalid_request')
  }
  db.prepare(
    `INSERT INTO promo_drink (id, item_id, headline, copy, image, ends_at, active) VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET item_id = excluded.item_id, headline = excluded.headline, copy = excluded.copy,
       image = excluded.image, ends_at = excluded.ends_at, active = excluded.active`,
  ).run(
    input.itemId,
    text(input.headline, 'The headline', 60),
    text(input.copy, 'The short copy', 140, false),
    assertLocalImage(input.imageUrl),
    iso(input.endsAt),
    input.active ? 1 : 0,
  )
  publishMenuChanged()
}

/* ---------- Banners ---------- */

export interface BannerInput {
  title: string
  body: string
  imageUrl: string | null
  itemId: number | null
  active: boolean
  startsAt: string | null
  endsAt: string | null
}

export function createBanner(input: BannerInput): number {
  const max = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM promos').get() as { m: number }).m
  const id = Number(
    db
      .prepare('INSERT INTO promos (title, body, image, item_id, active, starts_at, ends_at, sort_order, is_sample) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)')
      .run(text(input.title, 'The title', 60), text(input.body, 'The text', 160, false), assertLocalImage(input.imageUrl), input.itemId, input.active ? 1 : 0, iso(input.startsAt), iso(input.endsAt), max + 1)
      .lastInsertRowid,
  )
  publishMenuChanged()
  return id
}

export function updateBanner(id: number, input: BannerInput): void {
  const info = db
    .prepare('UPDATE promos SET title = ?, body = ?, image = ?, item_id = ?, active = ?, starts_at = ?, ends_at = ? WHERE id = ?')
    .run(text(input.title, 'The title', 60), text(input.body, 'The text', 160, false), assertLocalImage(input.imageUrl), input.itemId, input.active ? 1 : 0, iso(input.startsAt), iso(input.endsAt), id)
  if (info.changes === 0) throw new OrderError('Banner not found.', 'not_found', 404)
  publishMenuChanged()
}

export function deleteBanner(id: number): void {
  const info = db.prepare('DELETE FROM promos WHERE id = ?').run(id)
  if (info.changes === 0) throw new OrderError('Banner not found.', 'not_found', 404)
  publishMenuChanged()
}

/* ---------- Discount codes ---------- */

export interface CodeInput {
  code: string
  kind: 'percent' | 'fixed'
  value: number
  startsAt: string | null
  endsAt: string | null
  active: boolean
  maxUses: number | null
}

function checkCode(input: CodeInput): string {
  const code = input.code.trim().toUpperCase()
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) throw new OrderError('A code is 3 to 20 letters, numbers or dashes.', 'invalid_request')
  if (input.kind === 'percent' && !(input.value >= 1 && input.value <= 100)) throw new OrderError('A percentage is between 1 and 100.', 'invalid_request')
  if (input.kind === 'fixed' && !(input.value >= 100)) throw new OrderError('A fixed discount is at least AED 1.', 'invalid_request')
  const start = iso(input.startsAt)
  const end = iso(input.endsAt)
  if (start && end && end < start) throw new OrderError('The end date comes before the start date.', 'invalid_request')
  return code
}

export function createCode(input: CodeInput): number {
  const code = checkCode(input)
  if (db.prepare('SELECT 1 FROM discount_codes WHERE code = ?').get(code)) throw new OrderError('That code already exists.', 'duplicate', 409)
  const id = Number(
    db
      .prepare('INSERT INTO discount_codes (code, kind, value, starts_at, ends_at, active, max_uses, is_sample, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)')
      .run(code, input.kind, Math.round(input.value), iso(input.startsAt), iso(input.endsAt), input.active ? 1 : 0, input.maxUses, new Date().toISOString()).lastInsertRowid,
  )
  return id
}

export function updateCode(id: number, input: CodeInput): void {
  const code = checkCode(input)
  const clash = db.prepare('SELECT id FROM discount_codes WHERE code = ? AND id != ?').get(code, id)
  if (clash) throw new OrderError('That code already exists.', 'duplicate', 409)
  const info = db
    .prepare('UPDATE discount_codes SET code = ?, kind = ?, value = ?, starts_at = ?, ends_at = ?, active = ?, max_uses = ? WHERE id = ?')
    .run(code, input.kind, Math.round(input.value), iso(input.startsAt), iso(input.endsAt), input.active ? 1 : 0, input.maxUses, id)
  if (info.changes === 0) throw new OrderError('Code not found.', 'not_found', 404)
}

export function deleteCode(id: number): void {
  const info = db.prepare('DELETE FROM discount_codes WHERE id = ?').run(id)
  if (info.changes === 0) throw new OrderError('Code not found.', 'not_found', 404)
}

export interface ResolvedCode extends DiscountCode {
  id: number
  code: string
}

/** Finds a code a customer typed and checks it can be used right now. The messages are written for the customer. */
export function resolveCode(raw: string, nowMs = Date.now()): ResolvedCode {
  const code = raw.trim().toUpperCase()
  const row = db.prepare('SELECT * FROM discount_codes WHERE code = ?').get(code) as
    | { id: number; code: string; kind: 'percent' | 'fixed'; value: number; starts_at: string | null; ends_at: string | null; active: number; max_uses: number | null; uses: number }
    | undefined
  if (!row || !row.active) throw new OrderError("That code isn't valid.", 'code_invalid', 409)
  if (row.starts_at && Date.parse(row.starts_at) > nowMs) throw new OrderError("That code isn't active yet.", 'code_early', 409)
  if (row.ends_at && Date.parse(row.ends_at) < nowMs) throw new OrderError('That code has expired.', 'code_expired', 409)
  if (row.max_uses != null && row.uses >= row.max_uses) throw new OrderError('That code has been used up.', 'code_used_up', 409)
  return { id: row.id, code: row.code, kind: row.kind, value: row.value }
}

/** Counts a use. Returns false if someone else used the last one a moment ago. */
export function consumeCode(id: number): boolean {
  const info = db.prepare('UPDATE discount_codes SET uses = uses + 1 WHERE id = ? AND (max_uses IS NULL OR uses < max_uses)').run(id)
  return info.changes === 1
}

export function releaseCode(code: string | null): void {
  if (code) db.prepare('UPDATE discount_codes SET uses = MAX(0, uses - 1) WHERE code = ?').run(code)
}
