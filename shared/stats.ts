export type StatsRange = 'today' | '7d' | '30d'

/** The numbers shown at the top, and the same numbers for the period to compare with. */
export interface StatsKpis {
  /** Paid money from orders that were not cancelled. */
  revenueFils: number
  /** Orders placed and not cancelled, whether or not they are paid yet. */
  orders: number
  cancelled: number
  /** Revenue divided by paid orders. Null when nothing was paid. */
  avgOrderFils: number | null
  /** Start of making to ready, on average. Null when no order has been made. */
  avgPrepSeconds: number | null
  /** Confirmed (or due) to start of making, on average. */
  avgWaitSeconds: number | null
  /** Share of finished orders that were late, 0 to 1. Null when none have finished. */
  lateRate: number | null
  lateOrders: number
  /** Average star rating, 1 to 5. Null when nobody has rated. */
  rating: number | null
  ratingCount: number
  /** Different customers who ordered. */
  customers: number
}

export interface StatsHour {
  hour: number
  orders: number
  revenueFils: number
}

export interface StatsDay {
  date: string
  orders: number
  revenueFils: number
}

export interface StatsItem {
  name: string
  kind: 'drink' | 'food'
  units: number
  revenueFils: number
}

export interface StatsCategory {
  slug: string
  name: string
  units: number
  revenueFils: number
}

export interface StatsQueuePoint {
  minute: number
  label: string
  /** Average number of orders waiting to be started at this time of day. */
  avg: number
  /** The most that were waiting at this time on any day in the range. */
  max: number
}

export interface StatsResponse {
  range: StatsRange
  label: string
  /** First and last business date in the range. */
  from: string
  to: string
  /** What the comparison is against, in words: "yesterday by now". */
  comparisonLabel: string
  generatedAt: string
  kpis: StatsKpis
  previous: StatsKpis
  hours: StatsHour[]
  days: StatsDay[]
  topItems: StatsItem[]
  popularDrink: StatsItem | null
  popularSnack: StatsItem | null
  categories: StatsCategory[]
  payment: { card: { orders: number; revenueFils: number }; cash: { orders: number; revenueFils: number } }
  timing: { asap: number; preorder: number }
  /** Orders from customers on their first order ever, and from customers who have ordered before. */
  customerSplit: { firstTimeOrders: number; repeatOrders: number; newCustomers: number; returningCustomers: number }
  loyalty: { pointsIssued: number; previousPointsIssued: number; tiers: { name: string; customers: number }[] }
  queue: StatsQueuePoint[]
  slowest: { name: string; avgSeconds: number; samples: number }[]
  leastPopular: { name: string; units: number }[]
}
