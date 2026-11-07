/**
 * How the parts of an order total fit together. The order matters, and the server is the only place
 * it is decided:
 *
 *   subtotal (menu prices)
 *   - Summit Box value      drinks paid for in advance
 *   - discount code         a percentage or fixed amount, taken off what is left
 *   - loyalty reward        a fixed amount, taken off what is left after the code
 *   = total to pay
 *
 * Nothing here can push the total below zero.
 */

export interface DiscountCode {
  kind: 'percent' | 'fixed'
  /** Percent (1 to 100) or fils, depending on kind. */
  value: number
}

export interface DiscountInput {
  subtotalFils: number
  passFils?: number
  code?: DiscountCode | null
  rewardFils?: number
}

export interface DiscountResult {
  subtotalFils: number
  passFils: number
  codeFils: number
  rewardFils: number
  totalFils: number
}

export function codeDiscountFils(base: number, code: DiscountCode): number {
  const raw = code.kind === 'percent' ? Math.floor((base * Math.min(100, Math.max(0, code.value))) / 100) : Math.max(0, Math.floor(code.value))
  return Math.min(base, raw)
}

export function applyDiscounts(input: DiscountInput): DiscountResult {
  const subtotal = Math.max(0, Math.floor(input.subtotalFils))
  const passFils = Math.min(subtotal, Math.max(0, Math.floor(input.passFils ?? 0)))
  const afterPass = subtotal - passFils
  const codeFils = input.code ? codeDiscountFils(afterPass, input.code) : 0
  const afterCode = afterPass - codeFils
  const rewardFils = Math.min(afterCode, Math.max(0, Math.floor(input.rewardFils ?? 0)))
  return { subtotalFils: subtotal, passFils, codeFils, rewardFils, totalFils: afterCode - rewardFils }
}
