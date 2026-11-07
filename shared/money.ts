/**
 * All money in the app is an integer number of fils (1 AED = 100 fils).
 * Never do arithmetic on decimal AED values.
 */

export const FILS_PER_AED = 100

/** 2500 -> "25", 3250 -> "32.50", 17500 -> "175", 125000 -> "1,250". */
export function formatAedNumber(fils: number): string {
  const sign = fils < 0 ? '-' : ''
  const abs = Math.abs(Math.round(fils))
  const whole = Math.floor(abs / FILS_PER_AED)
  const rest = abs % FILS_PER_AED
  const wholeText = whole.toLocaleString('en-US')
  return rest === 0 ? `${sign}${wholeText}` : `${sign}${wholeText}.${String(rest).padStart(2, '0')}`
}

/** Plain-text price for places that cannot use the styled Price component. */
export function formatAedText(fils: number): string {
  return `AED ${formatAedNumber(fils)}`
}

/** Signed add-on text: "+6", "+1.50". */
export function formatDelta(fils: number): string {
  return `${fils < 0 ? '-' : '+'}${formatAedNumber(Math.abs(fils))}`
}
