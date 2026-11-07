/** Types shared by the API server and the web app. Plain data only, no behaviour. */

export type Temperature = 'hot' | 'iced' | 'both' | 'none'
export type OrderStatus =
  | 'awaiting_payment'
  | 'scheduled'
  | 'queued'
  | 'preparing'
  | 'ready'
  | 'collected'
  | 'cancelled'
export type Fulfilment = 'takeaway' | 'dinein'
export type PaymentMethod = 'card' | 'cash'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'
export type OrderAction = 'accept_payment' | 'start' | 'ready' | 'collect'

/* ---------- Config and auth ---------- */

export interface AppConfig {
  demoMode: boolean
  /** Public OAuth client id. Null when Google sign-in is not configured on this server. */
  googleClientId: string | null
  /** Public key for browser push notifications. Null when push is not available. */
  vapidPublicKey: string | null
}

export interface AuthUser {
  id: number
  name: string
  firstName: string
  email: string | null
  pictureUrl: string | null
  isDemo: boolean
}

export interface StaffUser {
  id: number
  username: string
  displayName: string
  role: 'admin' | 'barista'
}

/* ---------- Menu ---------- */

export interface MenuOption {
  id: number
  name: string
  priceDeltaFils: number
  isDefault: boolean
}

export interface MenuGroup {
  id: number
  key: string
  name: string
  kind: 'single' | 'multi'
  required: boolean
  /** When false, a default choice (for example regular milk) is left off the order line. */
  showDefault: boolean
  /** When true the line shows just the option name ("Oatly"), otherwise "Base: Banana". */
  inlineLabel: boolean
  options: MenuOption[]
}

export interface MenuItem {
  id: number
  slug: string
  name: string
  description: string
  priceFils: number
  temperature: Temperature
  caffeineFree: boolean
  soldOut: boolean
  /** Null until a photo exists (an upload, or a file at public/images/menu/<slug>.jpg). */
  imageUrl: string | null
  /** A drink can be paid for with a Summit Box; food cannot. */
  kind: 'drink' | 'food'
  groups: MenuGroup[]
}

export interface MenuCategory {
  id: number
  slug: string
  name: string
  items: MenuItem[]
}

export interface MenuResponse {
  categories: MenuCategory[]
}

/* ---------- Orders ---------- */

/** A coffee built in the builder. The server prices it from the builder options, never from the client. */
export interface CreationConfig {
  baseId: number
  temperature: 'hot' | 'iced'
  milkOptionId?: number | null
  flavourId?: number | null
  extraShots: number
  sweetnessId?: number | null
  toppingId?: number | null
}

/** One line the client asks for. Prices are never sent: the server prices every line itself. */
export interface OrderLineInput {
  /** A menu item. Left out when the line is a creation. */
  itemId?: number
  quantity: number
  /** Group id (as a string key) to the chosen option ids. */
  selections: Record<string, number[]>
  note?: string
  /** A builder creation, instead of a menu item. */
  creation?: CreationConfig & { name: string }
}

export interface CreateOrderInput {
  lines: OrderLineInput[]
  fulfilment: Fulfilment
  tableNumber?: string
  paymentMethod: PaymentMethod
  /** ISO time of the chosen pickup slot. Left out for "as soon as possible". */
  pickupAt?: string
  rewardId?: string
  code?: string
  /** Use drinks from the customer's Summit Box where they cover the order. */
  usePass?: boolean
}

export interface OrderLineView {
  id: number
  name: string
  quantity: number
  unitPriceFils: number
  lineTotalFils: number
  modifiers: string[]
  note: string | null
}

export interface QueueInfo {
  /** Orders that will be made before this one. Null when the order is not waiting in the queue. */
  ahead: number | null
  etaSeconds: number | null
  estimatedReadyAt: string | null
}

export interface OrderView {
  id: number
  number: number
  status: OrderStatus
  fulfilment: Fulfilment
  tableNumber: string | null
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  subtotalFils: number
  totalFils: number
  code: string | null
  codeFils: number
  rewardPoints: number
  rewardFils: number
  passUnits: number
  passFils: number
  pointsAwarded: number
  lines: OrderLineView[]
  createdAt: string
  confirmedAt: string | null
  /** The pickup slot for a pre-order. Null for "as soon as possible". */
  pickupAt: string | null
  /** When a pre-order will start being made (pickup time minus prep time). */
  dueAt: string | null
  startedAt: string | null
  readyAt: string | null
  collectedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  refunded: boolean
  rating: number | null
  ratingComment: string | null
  queue: QueueInfo
}

export interface OrdersStreamPayload {
  serverNow: string
  orders: OrderView[]
}

export interface QuoteResponse {
  lines: OrderLineView[]
  subtotalFils: number
  codeFils: number
  rewardFils: number
  passFils: number
  passUnits: number
  totalFils: number
  /** Points this order would earn, at the member's current tier. Zero for guests. */
  pointsToEarn: number
  ahead: number
  etaSeconds: number
  /** Set when the pickup time was chosen: when the order would be ready. */
  readyAt: string | null
  /** A friendly problem with the code or reward the customer chose, if any. The rest of the quote still stands. */
  notices: string[]
}

export interface QueueStatus {
  inQueue: number
  /** Wait for a typical single drink ordered right now. */
  estimateSeconds: number
}

/* ---------- Loyalty ---------- */

export interface LedgerEntry {
  id: number
  delta: number
  kind: 'earn' | 'redeem' | 'refund' | 'adjust'
  reason: string
  orderId: number | null
  createdAt: string
}

export interface TierView {
  name: string
  minPoints: number
  multiplier: number
  perks: string[]
}

export interface RewardView {
  id: string
  label: string
  costPoints: number
  discountFils: number
  minTier: string
  unlocked: boolean
  affordable: boolean
}

export interface LoyaltySummary {
  /** Points available to spend. */
  balance: number
  /** Points ever earned. Decides the tier. */
  lifetime: number
  tier: TierView
  nextTier: TierView | null
  pointsToNext: number
  /** 0 to 1 across the current tier's band. */
  fraction: number
  /** Position on the climb: tier index plus fraction. */
  climb: number
  tiers: TierView[]
  rewards: RewardView[]
  history: LedgerEntry[]
}

/* ---------- Dashboard ---------- */

export interface StaffOrderView extends OrderView {
  customerName: string
  receiptId: string | null
  prepSeconds: number
  late: boolean
}

export interface Board {
  serverNow: string
  lateAfterSeconds: number
  pos: { label: string; connected: boolean }
  awaiting: StaffOrderView[]
  scheduled: StaffOrderView[]
  queue: StaffOrderView[]
  ready: StaffOrderView[]
  completed: StaffOrderView[]
}

export interface ApiError {
  error: string
  code?: string
}
