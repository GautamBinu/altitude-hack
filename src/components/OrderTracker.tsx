import { trackerPosition, TRACKER_STEPS } from '@shared/orderFlow'
import type { OrderStatus } from '@shared/types'
import { useId } from 'react'
import { cx } from '../lib/cx'

/*
  The tracker is a short climb along the cafe's light band: four stops, rising left to right.
  The track fills as the order moves. The current stop carries the glow; finished stops are solid;
  stops still to come are outlined. Labels and an aria-current marker carry the state in words,
  so it never depends on colour.
*/

const WIDTH = 400
const HEIGHT = 108
const XS = [50, 150, 250, 350]
const YS = [88, 64, 40, 18]
const NODE_R = 12

const TRACK = XS.slice(1).reduce(
  (path, x, i) => {
    const mid = (XS[i] + x) / 2
    return `${path} C ${mid} ${YS[i]}, ${mid} ${YS[i + 1]}, ${x} ${YS[i + 1]}`
  },
  `M ${XS[0]} ${YS[0]}`,
)

export function OrderTracker({ status, className }: { status: OrderStatus; className?: string }) {
  const { done, current } = trackerPosition(status)
  const finished = done === 4
  // The lit band runs to the last finished stop, and on to the current one when it is in progress.
  const reach = finished ? 3 : current != null ? current : Math.max(0, done - 1)
  const progress = reach / 3
  const labelId = useId()
  const stepText = finished ? 'Step 4 of 4, collected' : `Step ${Math.min(4, (current ?? done) + 1)} of 4`

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="block h-auto w-full overflow-visible"
        aria-hidden="true"
        focusable="false"
      >
        {/* the unlit band */}
        <path d={TRACK} fill="none" stroke="var(--c-control)" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
        {/* the lit band: its length is the progress */}
        <path
          d={TRACK}
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth="3.5"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - progress}
          style={{
            transition: 'stroke-dashoffset 800ms cubic-bezier(0.16, 1, 0.3, 1)',
            filter: finished || status === 'cancelled' ? undefined : 'var(--glow)',
          }}
        />
        {XS.map((x, i) => {
          const complete = i < done
          const isCurrent = i === current
          return (
            <g key={x} transform={`translate(${x} ${YS[i]})`}>
              {isCurrent && (
                <circle
                  r={NODE_R + 5}
                  fill="none"
                  stroke="var(--c-accent)"
                  strokeWidth="1.5"
                  opacity="0.45"
                  style={{ filter: 'var(--glow)' }}
                />
              )}
              <circle
                r={NODE_R}
                fill={complete ? 'var(--c-accent)' : 'var(--c-surface)'}
                stroke={complete || isCurrent ? 'var(--c-accent)' : 'var(--c-control)'}
                strokeWidth={isCurrent ? 3.5 : 2.5}
                style={{ transition: 'fill 400ms ease-out, stroke 400ms ease-out' }}
              />
              {complete && !isCurrent && (
                <path
                  d="M -5.5 0.5 L -1.5 4.5 L 6 -4"
                  fill="none"
                  stroke="var(--c-on-accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {isCurrent && <circle r="4.5" fill="var(--c-accent)" />}
            </g>
          )
        })}
      </svg>

      <ol className="mt-1 grid grid-cols-4 text-center" aria-label="Order progress" aria-describedby={labelId}>
        {TRACKER_STEPS.map((label, i) => {
          const complete = i < done
          const isCurrent = i === current
          return (
            <li
              key={label}
              aria-current={isCurrent ? 'step' : undefined}
              className={cx(
                'flex items-center justify-center gap-1 text-body-sm',
                isCurrent ? 'font-semibold text-ink' : complete ? 'text-ink' : 'text-muted',
              )}
            >
              {label}
              <span className="sr-only">{complete && !isCurrent ? ', done' : isCurrent ? ', now' : ', to come'}</span>
            </li>
          )
        })}
      </ol>
      <span id={labelId} className="sr-only">
        {stepText}
      </span>
    </div>
  )
}

/** A thin four-part bar for the sticky mini tracker. */
export function MiniProgress({ status }: { status: OrderStatus }) {
  const { done, current } = trackerPosition(status)
  return (
    <div className="flex gap-1" aria-hidden="true">
      {[0, 1, 2, 3].map((n) => (
        <span
          key={n}
          className={cx(
            'h-1 w-6 rounded-full transition-colors duration-500',
            n < done && n !== current ? 'bg-accent' : n === current ? 'bg-accent shadow-band' : 'bg-control/50',
          )}
        />
      ))}
    </div>
  )
}
