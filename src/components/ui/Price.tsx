import { formatAedNumber, formatDelta } from '@shared/money'
import { cx } from '../../lib/cx'

const SIZES = {
  sm: 'text-title',
  md: 'text-price',
  lg: 'text-headline',
  xl: 'text-display-lg',
} as const

interface PriceProps {
  fils: number
  size?: keyof typeof SIZES
  className?: string
}

/** Prices: condensed face, tabular figures, "AED" as a small label beside the number, never a symbol. */
export function Price({ fils, size = 'md', className }: PriceProps) {
  return (
    <span className={cx('inline-flex items-baseline gap-1 whitespace-nowrap', className)}>
      <span className={cx('font-display font-semibold tnum leading-none', SIZES[size])}>{formatAedNumber(fils)}</span>
      <span className="text-label font-semibold uppercase text-muted">AED</span>
    </span>
  )
}

/** A signed add-on price such as "+6 AED". */
export function PriceDelta({ fils, className }: { fils: number; className?: string }) {
  return (
    <span className={cx('whitespace-nowrap text-body-sm tnum text-muted', className)}>
      {formatDelta(fils)} AED
    </span>
  )
}
