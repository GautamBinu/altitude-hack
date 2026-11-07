import { Router } from 'express'
import type { CreateOrderInput } from '../../shared/types'
import { getCustomer, requireCustomer } from '../auth'
import { OrderError } from '../domain/pricing'
import { createOrderSchema, orderLimiter, parse, quoteSchema } from '../http'
import { addCustomerStream } from '../realtime'
import { createOrder, quoteOrder } from '../services/orders'
import { getOrderForUser, listOrdersForUser } from '../services/views'

export const orderRoutes = Router()

// Price and time a cart without placing it. Open to guests so the cart works before sign-in.
orderRoutes.post('/orders/quote', orderLimiter, (req, res) => {
  const { lines } = parse(quoteSchema, req.body)
  res.json(quoteOrder(lines.map((l) => ({ ...l, note: l.note }))))
})

// Place an order. Card details are never part of this request: the card form is a prototype.
orderRoutes.post('/orders', requireCustomer, orderLimiter, async (req, res) => {
  const input = parse(createOrderSchema, req.body) as CreateOrderInput
  const customer = getCustomer(res)!
  const order = await createOrder(customer, input)
  res.status(201).json({ order })
})

orderRoutes.get('/orders/mine', requireCustomer, (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ serverNow: new Date().toISOString(), orders: listOrdersForUser(getCustomer(res)!.id) })
})

orderRoutes.get('/orders/:id', requireCustomer, (req, res) => {
  const id = Number(req.params.id)
  const order = Number.isInteger(id) ? getOrderForUser(id, getCustomer(res)!.id) : undefined
  if (!order) throw new OrderError("We couldn't find that order.", 'not_found', 404)
  res.set('Cache-Control', 'no-store')
  res.json({ serverNow: new Date().toISOString(), order })
})

// Live updates for the signed-in customer's own orders.
orderRoutes.get('/stream/orders', requireCustomer, (req, res) => {
  addCustomerStream(getCustomer(res)!.id, req, res)
})
