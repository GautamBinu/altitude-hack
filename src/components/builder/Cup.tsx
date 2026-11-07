import type { Described } from '@shared/builder'
import { useId } from 'react'

/* A cup that redraws as the recipe changes. Hot is a mug with steam, iced is a tall glass with ice and a
   straw. Colours come from the options the team set in the dashboard, so the picture follows their menu. */

const FALLBACK_COFFEE = '#5a3a24'
const MILK = '#efe2cf'
const FOAM = '#f6ecdc'
const CREMA = '#c9976a'

function toRgb(hex: string): [number, number, number] {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : FALLBACK_COFFEE.slice(1)
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** A colour between two hex colours. 0 is all `a`, 1 is all `b`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = toRgb(a)
  const [br, bg, bb] = toRgb(b)
  const channel = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`
}

const slide = { transition: 'fill 320ms ease, opacity 320ms ease, transform 320ms ease' } as const

interface Props {
  recipe: Described
  className?: string
}

/** Crumbs, cocoa or nuts scattered on the surface. The positions are fixed so the picture does not jitter. */
const SPECKS: [number, number][] = [
  [0.14, 0.2], [0.3, 0.6], [0.42, 0.15], [0.55, 0.7], [0.68, 0.25], [0.8, 0.62], [0.88, 0.22], [0.24, 0.85], [0.62, 0.4], [0.5, 0.45],
]

export function Cup({ recipe, className }: Props) {
  const clipId = useId()
  const iced = recipe.config.temperature === 'iced'
  const shots = recipe.config.extraShots
  const coffee = recipe.base.color ?? FALLBACK_COFFEE
  const hasMilk = recipe.milk !== null
  const toppingName = recipe.topping?.name.toLowerCase() ?? ''
  const whipped = toppingName.includes('cream')
  const toppingColor = recipe.topping?.color ?? '#5a3a28'

  // The liquid's box inside the vessel.
  const left = iced ? 78 : 66
  const right = iced ? 162 : 166
  const top = iced ? 86 : 112
  const bottom = iced ? 234 : 232
  const height = bottom - top
  const width = right - left

  // Black coffee is one colour with crema on top. With milk, the shots sit below and the milky drink above.
  const coffeeShare = hasMilk ? Math.min(0.62, 0.26 + shots * 0.1) : 1
  const milkBottom = top + height * (1 - coffeeShare)
  const drink = hasMilk ? mix(coffee, MILK, 0.62) : coffee
  const deep = mix(coffee, '#000000', 0.22)
  const flavour = recipe.flavour?.color ?? null

  const vessel = iced
    ? 'M70 62 H170 L159 232 Q158 242 148 242 H92 Q82 242 81 232 Z'
    : 'M60 100 H172 V202 Q172 240 134 240 H98 Q60 240 60 202 Z'

  const label = [
    iced ? 'Iced' : 'Hot',
    recipe.base.name,
    recipe.flavour?.name,
    shots > 0 ? `${shots} extra ${shots === 1 ? 'shot' : 'shots'}` : null,
    recipe.topping?.name,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <svg viewBox="0 0 240 270" role="img" aria-label={`Your coffee: ${label}`} className={className}>
      <defs>
        <clipPath id={clipId}>
          <path d={vessel} />
        </clipPath>
      </defs>

      {/* Steam over a hot drink with no cream on it. */}
      {!iced && !whipped && (
        <g fill="none" stroke="var(--c-muted)" strokeWidth="3" strokeLinecap="round" opacity="0.45">
          <path d="M96 88 Q88 74 96 62 Q104 50 96 38" />
          <path d="M120 84 Q112 68 120 54 Q128 42 120 28" />
          <path d="M144 88 Q136 74 144 62 Q152 50 144 38" />
        </g>
      )}

      {/* Handle, then the vessel, then what is in it. */}
      {!iced && <path d="M172 126 H190 Q214 126 214 160 Q214 194 190 194 H172" fill="none" stroke="var(--c-control)" strokeWidth="8" strokeLinecap="round" />}
      <path d={vessel} fill="var(--c-raised)" />

      <g clipPath={`url(#${clipId})`}>
        <rect x={left - 20} y={top} width={width + 40} height={bottom - top + 20} fill={drink} style={slide} />
        {hasMilk && <rect x={left - 20} y={milkBottom} width={width + 40} height={bottom - milkBottom + 20} fill={coffee} style={slide} />}
        {shots > 0 && <rect x={left - 20} y={bottom - 8 - shots * 5} width={width + 40} height={shots * 5 + 28} fill={deep} style={slide} />}

        {/* Flavour: a tint through the drink and a soft ribbon. */}
        {flavour && (
          <>
            <rect x={left - 20} y={top} width={width + 40} height={milkBottom - top} fill={flavour} opacity="0.2" style={slide} />
            <path
              d={`M${left - 10} ${top + height * 0.34} Q${left + width * 0.25} ${top + height * 0.22} ${left + width * 0.5} ${top + height * 0.34} T${right + 10} ${top + height * 0.3} V${top + height * 0.46} Q${left + width * 0.75} ${top + height * 0.56} ${left + width * 0.5} ${top + height * 0.46} T${left - 10} ${top + height * 0.5} Z`}
              fill={flavour}
              opacity="0.6"
              style={slide}
            />
          </>
        )}

        {/* Foam or crema on the surface. */}
        <rect x={left - 20} y={top} width={width + 40} height={hasMilk ? 10 : 7} fill={hasMilk ? FOAM : CREMA} style={slide} />

        {iced && (
          <g fill="#ffffff" fillOpacity="0.32" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.5">
            <rect x="88" y={top + 4} width="28" height="28" rx="5" transform={`rotate(-12 102 ${top + 18})`} />
            <rect x="122" y={top + 12} width="30" height="30" rx="5" transform={`rotate(10 137 ${top + 27})`} />
            <rect x="102" y={top + 36} width="26" height="26" rx="5" transform={`rotate(-4 115 ${top + 49})`} />
          </g>
        )}
      </g>

      {/* Glass edge, drawn over the drink. */}
      <path d={vessel} fill="none" stroke="var(--c-control)" strokeWidth="3" strokeLinejoin="round" />
      {iced && <line x1="150" y1="22" x2="126" y2="200" stroke="var(--c-accent)" strokeWidth="6" strokeLinecap="round" />}

      {/* Toppings sit on the surface. */}
      {whipped && (
        <g fill={FOAM} stroke="var(--c-control)" strokeWidth="1.5" style={slide}>
          <circle cx={iced ? 100 : 98} cy={top - 4} r="15" />
          <circle cx={iced ? 120 : 144} cy={top - 4} r="15" />
          <circle cx={iced ? 140 : 121} cy={top - 6} r="17" />
          <circle cx={iced ? 120 : 121} cy={top - 22} r="12" />
        </g>
      )}
      {recipe.topping && !whipped && (
        <g fill={toppingColor} style={slide}>
          {SPECKS.map(([x, y], i) => (
            <circle key={i} cx={left + 6 + x * (width - 12)} cy={top + 2 + y * 9} r={i % 3 === 0 ? 3 : 2.2} />
          ))}
        </g>
      )}

      {/* Each extra shot is a small glass beside the cup. */}
      {Array.from({ length: shots }, (_, i) => (
        <g key={i} transform={`translate(${14 + i * 24} 212)`}>
          <path d="M0 0 H20 L18 30 H2 Z" fill="var(--c-raised)" stroke="var(--c-control)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M2.4 10 H17.6 L16.6 28 H3.4 Z" fill={deep} />
        </g>
      ))}

      {/* A saucer line to stand it on. */}
      <ellipse cx="120" cy="252" rx={iced ? 56 : 84} ry="6" fill="var(--c-line)" />
    </svg>
  )
}
