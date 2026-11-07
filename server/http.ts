import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { ZodError, z } from 'zod'
import { OrderError } from './domain/pricing'

/* Request validation, rate limits and error handling shared by every route. */

/** Reject cross-site writes. Browsers always send Origin on cross-origin POSTs. */
export function originGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  const origin = req.headers.origin
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        res.status(403).json({ error: 'Cross-site request blocked.', code: 'bad_origin' })
        return
      }
    } catch {
      res.status(403).json({ error: 'Cross-site request blocked.', code: 'bad_origin' })
      return
    }
  }
  next()
}

const limiterDefaults = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: 'Too many requests. Wait a moment and try again.', code: 'rate_limited' })
  },
}

/** Sign-in endpoints. */
export const authLimiter = rateLimit({ ...limiterDefaults, windowMs: 15 * 60 * 1000, limit: 40 })

/** Dashboard password attempts. Successful logins do not count against the limit. */
export const staffLoginLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 5 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
})

/** Quoting and placing orders. */
export const orderLimiter = rateLimit({ ...limiterDefaults, windowMs: 10 * 60 * 1000, limit: 120 })

/** The mood suggester. Each request may cost a model call, so it is limited per address. */
export const moodLimiter = rateLimit({ ...limiterDefaults, windowMs: 10 * 60 * 1000, limit: 40 })

/* ---------- Schemas ---------- */

const orderLine = z.object({
  itemId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20),
  selections: z.record(z.string().regex(/^\d+$/), z.array(z.number().int().positive()).max(30)).default({}),
  note: z.string().max(280).optional(),
})

export const quoteSchema = z.object({
  lines: z.array(orderLine).min(1, 'Your order is empty.').max(30),
  rewardId: z.string().max(40).optional(),
  code: z.string().max(40).optional(),
  pickupAt: z.string().max(40).optional(),
})

export const createOrderSchema = z
  .object({
    lines: z.array(orderLine).min(1, 'Your order is empty.').max(30),
    fulfilment: z.enum(['takeaway', 'dinein']),
    tableNumber: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{1,6}$/, 'Table number can be up to 6 letters or numbers.')
      .optional(),
    paymentMethod: z.enum(['card', 'cash']),
    rewardId: z.string().max(40).optional(),
    code: z.string().max(40).optional(),
    pickupAt: z.string().max(40).optional(),
  })
  .refine((v) => v.fulfilment !== 'dinein' || !!v.tableNumber, {
    message: 'Add your table number for dine-in.',
    path: ['tableNumber'],
  })

export const googleSignInSchema = z.object({ credential: z.string().min(20).max(4096) })

export const staffLoginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
})

export const actionSchema = z.enum(['accept_payment', 'start', 'ready', 'collect'])

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data)
}

/* ---------- Errors ---------- */

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error)
  if (error instanceof OrderError) {
    res.status(error.status).json({ error: error.message, code: error.code })
    return
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: error.issues[0]?.message ?? 'That request was not valid.', code: 'invalid_request' })
    return
  }
  if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
    res.status(400).json({ error: 'That request was not valid.', code: 'invalid_request' })
    return
  }
  console.error('[server] unexpected error', error)
  res.status(500).json({ error: 'Something went wrong on our side. Try again.', code: 'internal' })
}
