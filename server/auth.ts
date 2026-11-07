import { createHash, randomBytes } from 'node:crypto'
import type { CookieOptions, NextFunction, Request, Response } from 'express'
import type { AuthUser, StaffUser } from '../shared/types'
import { config } from './config'
import { db } from './db'

export const CUSTOMER_COOKIE = 'alt_session'
export const STAFF_COOKIE = 'alt_staff'

const CUSTOMER_TTL_MS = 30 * 24 * 60 * 60 * 1000
const STAFF_TTL_MS = 12 * 60 * 60 * 1000

type SessionKind = 'customer' | 'staff'

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

function cookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
    maxAge: maxAgeMs,
  }
}

/** Create a session and set its cookie. Only a hash of the token is stored, so a leaked database cannot be replayed. */
function startSession(res: Response, kind: SessionKind, principalId: number): void {
  const token = randomBytes(32).toString('base64url')
  const ttl = kind === 'customer' ? CUSTOMER_TTL_MS : STAFF_TTL_MS
  db.prepare('INSERT INTO sessions (token_hash, kind, principal_id, expires_at) VALUES (?, ?, ?, ?)').run(
    hash(token),
    kind,
    principalId,
    new Date(Date.now() + ttl).toISOString(),
  )
  res.cookie(kind === 'customer' ? CUSTOMER_COOKIE : STAFF_COOKIE, token, cookieOptions(ttl))
}

function endSession(req: Request, res: Response, kind: SessionKind): void {
  const name = kind === 'customer' ? CUSTOMER_COOKIE : STAFF_COOKIE
  const token = req.cookies?.[name]
  if (typeof token === 'string') db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token))
  res.clearCookie(name, { ...cookieOptions(0), maxAge: undefined })
}

function principalFor(req: Request, kind: SessionKind): number | null {
  const name = kind === 'customer' ? CUSTOMER_COOKIE : STAFF_COOKIE
  const token = req.cookies?.[name]
  if (typeof token !== 'string' || token.length < 20) return null
  const row = db
    .prepare('SELECT principal_id, expires_at FROM sessions WHERE token_hash = ? AND kind = ?')
    .get(hash(token), kind) as { principal_id: number; expires_at: string } | undefined
  if (!row) return null
  if (Date.parse(row.expires_at) < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token))
    return null
  }
  return row.principal_id
}

export function purgeExpiredSessions(): void {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString())
}

/* ---------- Customers ---------- */

interface UserRow {
  id: number
  email: string | null
  name: string
  first_name: string
  picture_url: string | null
  is_demo: number
}

const toAuthUser = (row: UserRow): AuthUser => ({
  id: row.id,
  name: row.name,
  firstName: row.first_name,
  email: row.email,
  pictureUrl: row.picture_url,
  isDemo: row.is_demo === 1,
})

export function findCustomer(req: Request): AuthUser | null {
  const id = principalFor(req, 'customer')
  if (id == null) return null
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
  return row ? toAuthUser(row) : null
}

export function signInCustomer(
  res: Response,
  profile: { sub: string; email: string | null; name: string; firstName: string; pictureUrl: string | null; isDemo: boolean },
): AuthUser {
  db.prepare(
    `INSERT INTO users (google_sub, email, name, first_name, picture_url, is_demo, created_at)
     VALUES (@sub, @email, @name, @firstName, @pictureUrl, @isDemo, @createdAt)
     ON CONFLICT (google_sub) DO UPDATE SET
       email = excluded.email, name = excluded.name, first_name = excluded.first_name,
       picture_url = excluded.picture_url`,
  ).run({ ...profile, isDemo: profile.isDemo ? 1 : 0, createdAt: new Date().toISOString() })
  const row = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(profile.sub) as UserRow
  startSession(res, 'customer', row.id)
  return toAuthUser(row)
}

export function signOutCustomer(req: Request, res: Response): void {
  endSession(req, res, 'customer')
}

/** Attach the signed-in customer (if any) to the response for later handlers. */
export function attachCustomer(req: Request, res: Response, next: NextFunction): void {
  res.locals.customer = findCustomer(req)
  next()
}

export function getCustomer(res: Response): AuthUser | null {
  return (res.locals.customer as AuthUser | null | undefined) ?? null
}

export function requireCustomer(req: Request, res: Response, next: NextFunction): void {
  const customer = findCustomer(req)
  if (!customer) {
    res.status(401).json({ error: 'Sign in to continue.', code: 'signed_out' })
    return
  }
  res.locals.customer = customer
  next()
}

/* ---------- Staff ---------- */

interface StaffRow {
  id: number
  username: string
  display_name: string
  role: 'admin' | 'barista'
  password_hash: string
}

const toStaffUser = (row: StaffRow): StaffUser => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  role: row.role,
})

export function findStaffByUsername(username: string): StaffRow | undefined {
  return db.prepare('SELECT * FROM staff WHERE username = ? COLLATE NOCASE').get(username) as StaffRow | undefined
}

export function signInStaff(res: Response, row: StaffRow): StaffUser {
  startSession(res, 'staff', row.id)
  return toStaffUser(row)
}

export function signOutStaff(req: Request, res: Response): void {
  endSession(req, res, 'staff')
}

export function findStaff(req: Request): StaffUser | null {
  const id = principalFor(req, 'staff')
  if (id == null) return null
  const row = db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as StaffRow | undefined
  return row ? toStaffUser(row) : null
}

export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  const staff = findStaff(req)
  if (!staff) {
    res.status(401).json({ error: 'Sign in to the dashboard to continue.', code: 'signed_out' })
    return
  }
  res.locals.staff = staff
  next()
}

export function getStaff(res: Response): StaffUser {
  return res.locals.staff as StaffUser
}

/** Menu, prices, promotions, moderation and settings are for admins. Baristas run the counter. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireStaff(req, res, () => {
    if (getStaff(res).role !== 'admin') {
      res.status(403).json({ error: 'Only an admin can do that.', code: 'forbidden' })
      return
    }
    next()
  })
}
