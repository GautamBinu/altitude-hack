import { cx } from '../lib/cx'

/**
 * The official Altitude logo. Always the supplied files from public/brand, never redrawn,
 * recoloured or restyled. Cream on dark grounds, navy on light grounds.
 *
 * To swap in an SVG later, change the four paths below. Nothing else in the app refers to the files.
 * The intrinsic ratios are the PNGs' (full 491x516, mark 471x336); update them if the SVG differs.
 */
const SOURCES = {
  full: {
    cream: '/brand/altitude-logo-cream.png',
    navy: '/brand/altitude-logo-navy.png',
    ratio: 491 / 516,
  },
  mark: {
    cream: '/brand/altitude-mark-cream.png',
    navy: '/brand/altitude-mark-navy.png',
    ratio: 471 / 336,
  },
} as const

interface LogoProps {
  /** full: wordmark and chain-link. mark: chain-link only, for small sizes. */
  variant: 'full' | 'mark'
  /** Rendered height in px. Width follows the logo's own proportions. */
  height: number
  /**
   * auto follows the theme. cream or navy force one file, for use on a panel whose colour does not
   * change with the theme (the navy brand panel always takes cream).
   */
  tone?: 'auto' | 'cream' | 'navy'
  className?: string
}

export function Logo({ variant, height, tone = 'auto', className }: LogoProps) {
  const source = SOURCES[variant]
  const style = { height, width: Math.round(height * source.ratio) }
  const common = { style, draggable: false, decoding: 'async' as const }

  if (tone !== 'auto') {
    return <img src={source[tone]} alt="Altitude" className={cx('block max-w-none', className)} {...common} />
  }
  return (
    <>
      <img
        src={source.cream}
        alt="Altitude"
        className={cx('hidden max-w-none dark:block', className)}
        {...common}
      />
      <img
        src={source.navy}
        alt="Altitude"
        className={cx('block max-w-none dark:hidden', className)}
        {...common}
      />
    </>
  )
}
