import type { LoyaltySummary } from '@shared/types'
import { Mountains } from '../ui/Art'

/*
  Loyalty as a climb: four camps along a mountain ridge, one per tier. A marker sits on the ridge
  where the member's points put them, and the ridge is lit up to that point. The art behind is the
  same layered mountain silhouette used in empty states.
*/

const W = 400
const H = 120
const PEAKS = [
  { x: 36, y: 98 },
  { x: 140, y: 74 },
  { x: 256, y: 50 },
  { x: 364, y: 24 },
]

function pointAt(climb: number): { x: number; y: number } {
  const c = Math.min(PEAKS.length - 1, Math.max(0, climb))
  const i = Math.min(PEAKS.length - 2, Math.floor(c))
  const t = c - i
  const a = PEAKS[i]
  const b = PEAKS[i + 1]
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function litPath(climb: number): string {
  const c = Math.min(PEAKS.length - 1, Math.max(0, climb))
  const whole = Math.floor(c)
  const parts = PEAKS.slice(0, whole + 1).map((p) => `${p.x} ${p.y}`)
  const end = pointAt(c)
  if (c > whole) parts.push(`${end.x} ${end.y}`)
  return `M ${parts.join(' L ')}`
}

export function ClimbProgress({ summary }: { summary: LoyaltySummary }) {
  const tiers = summary.tiers
  const marker = pointAt(summary.climb)
  const full = `M ${PEAKS.map((p) => `${p.x} ${p.y}`).join(' L ')}`

  return (
    <div>
      <div className="relative">
      <div className="absolute inset-x-0 bottom-0 h-2/3 opacity-80">
        <Mountains />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="relative block h-auto w-full overflow-visible" aria-hidden="true" focusable="false">
        <path d={full} fill="none" stroke="var(--c-control)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" opacity="0.6" />
        <path
          d={litPath(summary.climb)}
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: 'var(--glow)', transition: 'd 600ms ease-out' }}
        />
        {PEAKS.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="6"
            fill={i <= Math.floor(summary.climb) ? 'var(--c-accent)' : 'var(--c-surface)'}
            stroke={i <= Math.floor(summary.climb) ? 'var(--c-accent)' : 'var(--c-control)'}
            strokeWidth="2.5"
          />
        ))}
        <circle cx={marker.x} cy={marker.y} r="11" fill="none" stroke="var(--c-accent)" strokeWidth="1.5" opacity="0.5" />
        <circle cx={marker.x} cy={marker.y} r="5" fill="var(--c-accent)" />
      </svg>
      </div>
      <ol className="mt-2 grid grid-cols-4 text-center text-body-sm" aria-label="Tiers">
        {tiers.map((tier) => (
          <li
            key={tier.name}
            aria-current={tier.name === summary.tier.name ? 'step' : undefined}
            className={tier.name === summary.tier.name ? 'font-semibold text-ink' : 'text-muted'}
          >
            {tier.name}
            <span className="block text-label tnum text-muted">{tier.minPoints.toLocaleString('en-US')}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
