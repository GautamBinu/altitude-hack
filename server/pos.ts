import { randomBytes } from 'node:crypto'
import type { PaymentMethod } from '../shared/types'

/**
 * Point-of-sale integration.
 *
 * Altitude's POS is MOBIPOS. We have no API access or documentation for it, so everything the app
 * needs from a POS sits behind this interface, and the only implementation is a mock.
 *
 * WHERE THE REAL MOBIPOS API PLUGS IN: write a class that implements PosAdapter (for example
 * MobiposAdapter in server/pos-mobipos.ts) that calls the MOBIPOS endpoints, then change the one
 * line at the bottom of this file to export that class instead of MockMobiposAdapter. Nothing else
 * in the app needs to change. Order creation calls createOrder and markPaid; accepting a cash
 * payment on the dashboard calls markPaid; voidOrder is ready for the cancel flow.
 */

export interface PosOrderInput {
  orderId: number
  orderNumber: number
  totalFils: number
  lines: { name: string; quantity: number; unitPriceFils: number }[]
}

export interface PosAdapter {
  readonly name: string
  status(): { connected: boolean; label: string }
  /** Register the order with the POS. Returns the POS's own id for it. */
  createOrder(order: PosOrderInput): Promise<{ posOrderId: string }>
  /** Record payment against a POS order. Returns a receipt id. */
  markPaid(
    posOrderId: string,
    payment: { method: PaymentMethod; amountFils: number },
  ): Promise<{ receiptId: string }>
  /** Cancel an order in the POS. */
  voidOrder(posOrderId: string, reason: string): Promise<void>
}

const fakeId = (prefix: string) => `${prefix}-${randomBytes(3).toString('hex').toUpperCase()}`

/** Stand-in for MOBIPOS: logs what it would send and hands back fake ids. Nothing leaves this server. */
export class MockMobiposAdapter implements PosAdapter {
  readonly name = 'MOBIPOS (mock)'

  status() {
    return { connected: true, label: 'POS sync: connected (demo)' }
  }

  async createOrder(order: PosOrderInput) {
    const posOrderId = fakeId('MOCK-ORD')
    console.log(`[pos:mock] createOrder #${order.orderNumber} total=${order.totalFils} -> ${posOrderId}`)
    return { posOrderId }
  }

  async markPaid(posOrderId: string, payment: { method: PaymentMethod; amountFils: number }) {
    const receiptId = fakeId('MOCK-RCPT')
    console.log(`[pos:mock] markPaid ${posOrderId} ${payment.method} ${payment.amountFils} -> ${receiptId}`)
    return { receiptId }
  }

  async voidOrder(posOrderId: string, reason: string) {
    console.log(`[pos:mock] voidOrder ${posOrderId} (${reason})`)
  }
}

export const pos: PosAdapter = new MockMobiposAdapter()
