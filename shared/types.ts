/** Types shared by the API server and the web app. Plain data only, no behaviour. */

export type Temperature = 'hot' | 'iced' | 'both' | 'none'
export type OrderStatus = 'awaiting_payment' | 'queued' | 'preparing' | 'ready' | 'collected'
export type Fulfilment = 'takeaway' | 'dinein'
export type PaymentMethod = 'card' | 'cash'
export type PaymentStatus = 'unpaid' | 'paid'
export type OrderAction = 'accept_payment' | 'start' | 'ready' | 'collect'

/* ---------- Config and auth ---------- */

export interface AppConfig {
  demoMode: boolean
  /** Public OAuth client id. Null when Google sign-in is not configured on this server. */
  googleClientId: string | null
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
  /** Null until a photo exists at public/images/menu/<slug>.jpg. */
  imageUrl: string | null
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

/** One line the client asks for. Prices are never sent: the server prices every line itself. */
export interface OrderLineInput {
  itemId: number
  quantity: number
  /** Group id (as a string key) to the chosen option ids. */
  selections: Record<string, number[]>
  note?: string
}

export interface CreateOrderInput {
  lines: OrderLineInput[]
  fulfilment: Fulfilment
  tableNumber?: string
  paymentMethod: PaymentMethod
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
  totalFils: number
  lines: OrderLineView[]
  createdAt: string
  confirmedAt: string | null
  startedAt: string | null
  readyAt: string | null
  collectedAt: string | null
  queue: QueueInfo
}

export interface OrdersStreamPayload {
  serverNow: string
  orders: OrderView[]
}

export interface QuoteResponse {
  lines: OrderLineView[]
  totalFils: number
  ahead: number
  etaSeconds: number
}

export interface QueueStatus {
  inQueue: number
  /** Wait for a typical single drink ordered right now. */
  estimateSeconds: number
}

/* ---------- Dashboard ---------- */

export interface StaffOrderView extends OrderView {
  customerName: string
  receiptId: string | null
  prepSeconds: number
}

export interface Board {
  serverNow: string
  lateAfterSeconds: number
  pos: { label: string; connected: boolean }
  awaiting: StaffOrderView[]
  queue: StaffOrderView[]
  ready: StaffOrderView[]
  completed: StaffOrderView[]
}

export interface ApiError {
  error: string
  code?: string
}
