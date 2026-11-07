import type { Request, Response } from 'express'
import type { OrdersStreamPayload } from '../shared/types'
import { getBoard, listOrdersForUser } from './services/views'

/**
 * Realtime updates over Server-Sent Events.
 *
 * Two kinds of listener: customers (each sees only their own orders) and staff (see the whole board).
 * Whenever an order changes, `publishChange` pushes fresh snapshots to everyone connected, so a
 * status change on the dashboard reaches the customer's phone without a refresh. A new snapshot is
 * also sent on connect, so a client that dropped and reconnected catches up straight away.
 */

interface CustomerClient {
  userId: number
  res: Response
}

const customers = new Set<CustomerClient>()
const staff = new Set<Response>()
/** Anyone with the app open, signed in or not. They only hear that the menu or promotions changed. */
const everyone = new Set<Response>()

function openStream(req: Request, res: Response): void {
  req.socket.setTimeout(0)
  req.socket.setNoDelay(true)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Tell nginx-style proxies not to buffer the stream.
    'X-Accel-Buffering': 'no',
  })
  // If the connection drops the browser retries after 3 seconds.
  res.write('retry: 3000\n\n')
}

function send(res: Response, event: string, data: unknown): void {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  } catch {
    /* the client went away; its close handler removes it */
  }
}

function customerPayload(userId: number): OrdersStreamPayload {
  return { serverNow: new Date().toISOString(), orders: listOrdersForUser(userId) }
}

export function addCustomerStream(userId: number, req: Request, res: Response): void {
  openStream(req, res)
  const client: CustomerClient = { userId, res }
  customers.add(client)
  req.on('close', () => customers.delete(client))
  send(res, 'orders', customerPayload(userId))
}

export function addStaffStream(req: Request, res: Response): void {
  openStream(req, res)
  staff.add(res)
  req.on('close', () => staff.delete(res))
  send(res, 'board', getBoard())
}

export function addPublicStream(req: Request, res: Response): void {
  openStream(req, res)
  everyone.add(res)
  req.on('close', () => everyone.delete(res))
  send(res, 'hello', { serverNow: new Date().toISOString() })
}

/** The menu, a price, a promotion or a post changed. Open apps fetch it again. */
export function publishMenuChanged(): void {
  for (const res of everyone) send(res, 'menu', { at: Date.now() })
}

let scheduled = false
let pendingNewOrders: { id: number; number: number }[] = []

/**
 * Tell everyone something changed. Several changes in the same tick are sent as one update.
 * Pass `newOrder` so the dashboard can play its alert.
 */
export function publishChange(newOrder?: { id: number; number: number }): void {
  if (newOrder) pendingNewOrders.push(newOrder)
  if (scheduled) return
  scheduled = true
  setImmediate(flush)
}

function flush(): void {
  scheduled = false
  const newOrders = pendingNewOrders
  pendingNewOrders = []

  if (staff.size > 0) {
    const board = getBoard()
    for (const res of staff) {
      send(res, 'board', board)
      for (const order of newOrders) send(res, 'new-order', order)
    }
  }

  const byUser = new Map<number, OrdersStreamPayload>()
  for (const client of customers) {
    let payload = byUser.get(client.userId)
    if (!payload) {
      payload = customerPayload(client.userId)
      byUser.set(client.userId, payload)
    }
    send(client.res, 'orders', payload)
  }
}

// Comment lines keep idle connections open through proxies and let us notice dead sockets.
setInterval(() => {
  for (const client of customers) client.res.write(': keep-alive\n\n')
  for (const res of staff) res.write(': keep-alive\n\n')
  for (const res of everyone) res.write(': keep-alive\n\n')
}, 20_000).unref()

// Elapsed times and ETAs move with the clock, so refresh everyone every 30 seconds too.
setInterval(() => {
  if (customers.size > 0 || staff.size > 0) publishChange()
}, 30_000).unref()
