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

/*
 * Limits are per address and meant to stop a runaway script, not a busy room. A whole campus can share one
 * public address, so they are set well above what a hundred students ordering at once would use.
 */

/** Sign-in endpoints. */
export const authLimiter = rateLimit({ ...limiterDefaults, windowMs: 15 * 60 * 1000, limit: 300 })

/** Dashboard password attempts. Successful logins do not count against the limit. */
export const staffLoginLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 5 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
})

/** Quoting and placing orders. */
export const orderLimiter = rateLimit({ ...limiterDefaults, windowMs: 10 * 60 * 1000, limit: 1500 })

/** Saving, sharing and favouriting. Writes only, so a runaway client cannot fill the table. */
export const builderLimiter = rateLimit({ ...limiterDefaults, windowMs: 10 * 60 * 1000, limit: 600 })

/**
 * Sending a post to the events feed. Open to guests, so it is the spam target. Only posts that were accepted
 * count, so a typo in the form never uses up someone's allowance. Per-person caps on posts waiting for
 * review (3 signed in, 2 per guest device, 60 overall) do the finer work.
 */
export const eventLimiter = rateLimit({ ...limiterDefaults, windowMs: 60 * 60 * 1000, limit: 40, skipFailedRequests: true })

/** "I'm interested", checking on a post, withdrawing one. */
export const interestLimiter = rateLimit({ ...limiterDefaults, windowMs: 10 * 60 * 1000, limit: 600 })

/** The mood suggester. Each request may cost a model call, so it is limited per address. */
export const moodLimiter = rateLimit({ ...limiterDefaults, windowMs: 10 * 60 * 1000, limit: 200 })

/* ---------- Schemas ---------- */

const id = z.number().int().positive()
const optionalId = id.nullable().optional()

/** A recipe from the coffee builder. Only ids and a name: the price is worked out on the server. */
export const creationSchema = z.object({
  name: z.string().min(1, 'Give your creation a name.').max(80),
  baseId: id,
  temperature: z.enum(['hot', 'iced']),
  milkOptionId: optionalId,
  flavourId: optionalId,
  extraShots: z.number().int().min(0).max(2).default(0),
  sweetnessId: optionalId,
  toppingId: optionalId,
})

/** A menu item with its choices, or a builder creation. Exactly one of the two. */
const orderLine = z
  .object({
    itemId: id.optional(),
    quantity: z.number().int().min(1).max(20),
    selections: z.record(z.string().regex(/^\d+$/), z.array(z.number().int().positive()).max(30)).default({}),
    note: z.string().max(280).optional(),
    creation: creationSchema.optional(),
  })
  .refine((line) => (line.itemId != null) !== (line.creation != null), { message: 'Each line is either a menu item or a creation.' })

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
