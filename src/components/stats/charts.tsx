import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { formatAedNumber } from '@shared/money'

/*
 * Charts use the theme's own colours: the accent for the thing being measured, muted tones for the rest.
 * Colours are read from CSS variables, so the charts follow the light and dark themes without extra code.
 * No gradients, no legends (the line above each chart says what it shows), and no animation.
 */

const TICK = { fill: 'var(--c-muted)', fontSize: 12 }
const AXIS = { stroke: 'var(--c-line)' }
const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 }

/** The row of data under the pointer, or nothing when the pointer is elsewhere. */
function pointOf<T>({ active, payload }: TooltipContentProps): T | undefined {
  return active ? (payload?.[0]?.payload as T | undefined) : undefined
}

function TipBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-raised px-3 py-2 shadow-float">
      <p className="text-body-sm font-semibold text-ink">{title}</p>
      <div className="mt-0.5 text-body-sm text-muted tnum">{children}</div>
    </div>
  )
}

export interface SalesPoint {
  label: string
  full: string
  revenueFils: number
  orders: number
}

export function SalesChart({ data }: { data: SalesPoint[] }) {
  return (
    <div className="h-64 w-full md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={MARGIN} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--c-line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={AXIS} tick={TICK} minTickGap={12} />
          <YAxis tickLine={false} axisLine={false} tick={TICK} width={48} tickFormatter={(v: number) => formatAedNumber(v)} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'var(--c-raised)' }}
            content={(props: TooltipContentProps) => {
              const p = pointOf<SalesPoint>(props)
              if (!p) return null
              return (
                <TipBox title={p.full}>
                  AED {formatAedNumber(p.revenueFils)} from {p.orders} {p.orders === 1 ? 'order' : 'orders'}
                </TipBox>
              )
            }}
          />
          <Bar dataKey="revenueFils" fill="var(--c-accent)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface HourPoint {
  label: string
  orders: number
  peak: boolean
}

/** Orders by hour. The busiest hour is the accent, the rest are muted, so the peak is the first thing seen. */
export function HoursChart({ data }: { data: HourPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={MARGIN} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--c-line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={AXIS} tick={TICK} minTickGap={12} />
          <YAxis tickLine={false} axisLine={false} tick={TICK} width={32} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'var(--c-raised)' }}
            content={(props: TooltipContentProps) => {
              const p = pointOf<HourPoint>(props)
              if (!p) return null
              return (
                <TipBox title={p.label}>
                  {p.orders} {p.orders === 1 ? 'order' : 'orders'}
                </TipBox>
              )
            }}
          />
          <Bar dataKey="orders" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.peak ? 'var(--c-accent)' : 'var(--c-control)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface QueuePoint {
  label: string
  avg: number
  max: number
}

/** How many orders were waiting to be started, through the day. Solid is the average day, dashed is the worst. */
export function QueueChart({ data }: { data: QueuePoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={MARGIN} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--c-line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={AXIS} tick={TICK} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} tick={TICK} width={32} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: 'var(--c-control)' }}
            content={(props: TooltipContentProps) => {
              const p = pointOf<QueuePoint>(props)
              if (!p) return null
              return (
                <TipBox title={p.label}>
                  <span className="block">Average: {p.avg.toFixed(1)} waiting</span>
                  <span className="block">Worst day: {p.max} waiting</span>
                </TipBox>
              )
            }}
          />
          <Line type="monotone" dataKey="max" stroke="var(--c-control)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="avg" stroke="var(--c-accent)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
