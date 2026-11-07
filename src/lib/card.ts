/*
  PROTOTYPE ONLY. The card form exists to show the payment flow. Everything typed here is checked in
  the browser and then thrown away: no card number, expiry, CVC or name is ever stored, logged or sent
  to any server, including ours. The order request carries only "card" as the payment method.
  A real launch would hand card entry to the payment provider's hosted fields instead.
*/

export function formatCardNumber(raw: string): string {
  return raw
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(.{4})/g, '$1 ')
    .trim()
}

export function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

/** Luhn check: catches typos in a card number. */
export function luhnValid(number: string): boolean {
  const digits = number.replace(/\D/g, '')
  if (digits.length < 13 || digits.length > 19) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i])
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

export interface CardFields {
  name: string
  number: string
  expiry: string
  cvc: string
}

export type CardErrors = Partial<Record<keyof CardFields, string>>

export function validateCard(fields: CardFields, now = new Date()): CardErrors {
  const errors: CardErrors = {}

  if (fields.name.trim().length < 2) errors.name = 'Enter the name on the card.'

  const digits = fields.number.replace(/\D/g, '')
  if (digits.length === 0) errors.number = 'Enter your card number.'
  else if (!luhnValid(digits)) errors.number = "That card number doesn't look right. Check it and try again."

  const match = /^(\d{2})\/(\d{2})$/.exec(fields.expiry)
  if (!match) {
    errors.expiry = 'Enter the expiry as MM/YY.'
  } else {
    const month = Number(match[1])
    const year = 2000 + Number(match[2])
    if (month < 1 || month > 12) errors.expiry = 'Month must be between 01 and 12.'
    else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
      errors.expiry = 'That card has expired.'
    }
  }

  if (!/^\d{3,4}$/.test(fields.cvc)) errors.cvc = 'Enter the 3 or 4 digit code.'

  return errors
}
