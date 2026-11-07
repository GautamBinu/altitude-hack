import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { z } from 'zod'
import type { OrderAction } from '../../shared/types'
import { findStaff, findStaffByUsername, getStaff, requireStaff, signInStaff, signOutStaff } from '../auth'
import { OrderError } from '../domain/pricing'
import { actionSchema, parse, staffLoginLimiter, staffLoginSchema } from '../http'
import { addStaffStream } from '../realtime'
import { cancelOrder, transitionOrder } from '../services/orders'
import { getBoard } from '../services/views'

export const dashboardRoutes = Router()

// Compared against when the username does not exist, so a wrong username and a wrong password take the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10)

dashboardRoutes.post('/dashboard/login', staffLoginLimiter, async (req, res) => {
  const { username, password } = parse(staffLoginSchema, req.body)
  const row = findStaffByUsername(username)
  const matches = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH)
  if (!row || !matches) {
    throw new OrderError("That username and password don't match.", 'bad_credentials', 401)
  }
  res.json({ user: signInStaff(res, row) })
})

dashboardRoutes.post('/dashboard/logout', (req, res) => {
  signOutStaff(req, res)
  res.json({ ok: true })
})

dashboardRoutes.get('/dashboard/me', (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ user: findStaff(req) })
})

// Everything below needs a dashboard login.
dashboardRoutes.use('/dashboard', requireStaff)

dashboardRoutes.get('/dashboard/board', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(getBoard())
})

dashboardRoutes.get('/dashboard/stream', (req, res) => {
  addStaffStream(req, res)
})

dashboardRoutes.post('/dashboard/orders/:id/cancel', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new OrderError('Unknown order.', 'not_found', 404)
  const body = parse(z.object({ reason: z.string().min(1).max(200), refund: z.boolean().default(false) }), req.body)
  const order = await cancelOrder(id, body, getStaff(res).username)
  res.json({ order })
})

const ACTIONS: Record<string, OrderAction> = {
  'accept-payment': 'accept_payment',
  start: 'start',
  ready: 'ready',
  collect: 'collect',
}

dashboardRoutes.post('/dashboard/orders/:id/:action', async (req, res) => {
  const id = Number(req.params.id)
  const action = ACTIONS[String(req.params.action)]
  if (!Number.isInteger(id) || !action) throw new OrderError('Unknown order action.', 'not_found', 404)
  parse(actionSchema, action)
  const order = await transitionOrder(id, action, getStaff(res).username)
  res.json({ order })
})
