import { cx } from '../../lib/cx'

/**
 * Layered mountain silhouettes: low-contrast oak and navy tints, used for empty states and the
 * fallback panel behind menu items that have no photo yet. Decorative only.
 */
export function Mountains({ flip = false, className }: { flip?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 400 160"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
      className={cx('pointer-events-none block h-full w-full', flip && '-scale-x-100', className)}
    >
      <path
        className="fill-oak/15"
        d="M0 112 L52 68 L92 96 L142 42 L192 92 L242 58 L302 102 L352 64 L400 96 L400 160 L0 160Z"
      />
      <path
        className="fill-oak/25"
        d="M0 132 L60 96 L112 122 L172 80 L232 120 L292 90 L352 126 L400 104 L400 160 L0 160Z"
      />
      <path
        className="fill-navy/60"
        d="M0 152 L72 126 L132 146 L202 114 L262 146 L332 124 L400 150 L400 160 L0 160Z"
      />
    </svg>
  )
}

/** A single hand-drawn tick that draws itself on a solid accent disc. Under 700ms in total. */
export function DrawnCheck({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="animate-pop-in">
      <circle cx="32" cy="32" r="30" fill="var(--c-accent)" />
      <path
        d="M19 33.5 L28 42 L45.5 22.5"
        fill="none"
        stroke="var(--c-on-accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1}
        style={{ animation: 'draw 420ms cubic-bezier(0.16, 1, 0.3, 1) 180ms forwards' }}
      />
    </svg>
  )
}

/** The cafe's light band, as a loading line. */
export function LoadingLine({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-busy="true"
      className={cx('relative h-0.5 w-full overflow-hidden rounded-full bg-line', className)}
    >
      <span className="absolute inset-y-0 left-0 w-2/5 animate-line-run rounded-full bg-accent" />
    </div>
  )
}
