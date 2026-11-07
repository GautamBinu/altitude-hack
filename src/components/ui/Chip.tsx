import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const TONES: Record<Tone, string> = {
  neutral: 'border-control text-muted',
  accent: 'border-accent text-accent',
  success: 'border-success text-success',
  warning: 'border-warning text-warning',
  danger: 'border-danger text-danger',
}

interface StatusChipProps {
  tone?: Tone
  /** Status is never colour alone: always pass the words, and an icon where it helps. */
  children: ReactNode
  icon?: ReactNode
  className?: string
}

/** Small status label. Pill shape is reserved for these (DESIGN.md, Shapes). */
export function StatusChip({ tone = 'neutral', children, icon, className }: StatusChipProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-label font-semibold uppercase',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
