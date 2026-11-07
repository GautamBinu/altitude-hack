import { randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { findCustomer } from './auth'
import { config } from './config'

/*
 * Who is looking, without making anyone sign in. A signed-in customer is "u:<id>". A guest gets a random
 * cookie the first time they do something that needs one (tap "I'm interested", send a post), and is
 * "g:<random>". It holds no personal data, and it is only used to count each person once.
 */

export const VIEWER_COOKIE = 'alt_viewer'
const YEAR_MS = 365 * 24 * 60 * 60 * 1000

export function viewerKey(req: Request, res: Response, options: { create: boolean }): string | null {
  const customer = findCustomer(req)
  if (customer) return `u:${customer.id}`

  const existing = req.cookies?.[VIEWER_COOKIE]
  if (typeof existing === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return `g:${existing}`
  if (!options.create) return null

  const token = randomBytes(18).toString('base64url')
  res.cookie(VIEWER_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.isProduction, path: '/', maxAge: YEAR_MS })
  return `g:${token}`
}
