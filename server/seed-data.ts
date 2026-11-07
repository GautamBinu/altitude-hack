import type { Temperature } from '../shared/types'

/**
 * Menu seed, transcribed from reference/altitude_menu.txt.
 *
 * Prices are in fils (AED x 100). The menu photo looks dated, so every price is seed data that the
 * team can change. Items the photo gave no price for use a placeholder and are flagged `unconfirmed`;
 * those placeholder figures are our estimates and are NOT Altitude's prices.
 *
 * Temperature, prep times and descriptions are our own working values, not from Altitude.
 * Prep times (seconds) feed the queue ETA and are placeholders until the team times real orders.
 */

export interface SeedItem {
  name: string
  /** Price in fils. */
  price: number
  /** True when the menu photo showed no price and `price` is a placeholder. */
  unconfirmed?: boolean
  temp: Temperature
  prep: number
  description: string
  caffeineFree?: boolean
  /** Offers the milk-alternative choice. */
  milk?: boolean
  /** Extra option group keys, in display order, after temperature. */
  groups?: string[]
  tags?: string[]
  /** drink or food. Defaults from the category. Drinks can be paid for with a Summit Box. */
  kind?: 'drink' | 'food'
}

export interface SeedCategory {
  slug: string
  name: string
  /** Default kind for the category's items. */
  kind: 'drink' | 'food'
  items: SeedItem[]
}

export const MILK_ALTERNATIVE_FILS = 600
export const PLACEHOLDER_NOTE = 'unconfirmed'

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    slug: 'espresso-bar',
    name: 'Espresso Bar',
    kind: 'drink',
    items: [
      { name: 'Single Espresso', price: 2000, temp: 'hot', prep: 45, description: 'One shot, short and strong.', tags: ['strong'] },
      { name: 'Double Espresso', price: 2200, temp: 'hot', prep: 60, description: 'Two shots in one cup.', tags: ['strong'] },
      { name: 'Americano', price: 2000, temp: 'both', prep: 75, description: 'Espresso lengthened with water.' },
      { name: 'Cortado', price: 2300, temp: 'hot', prep: 90, milk: true, description: 'Espresso cut with warm milk.' },
      { name: 'Piccolo', price: 2300, temp: 'hot', prep: 90, milk: true, description: 'A small glass of espresso with a splash of milk.' },
      { name: 'Flat White', price: 2500, temp: 'hot', prep: 120, milk: true, description: 'Espresso with smooth steamed milk.', tags: ['creamy'] },
      { name: 'Cafe Latte', price: 2500, temp: 'both', prep: 120, milk: true, description: 'Espresso with steamed milk and a light foam.', tags: ['creamy'] },
      { name: 'Affogato', price: 2500, temp: 'none', prep: 90, description: 'Espresso poured over ice cream.', tags: ['sweet'] },
      { name: 'Raf Coffee', price: 2800, temp: 'hot', prep: 150, milk: true, description: 'A creamy, sweet espresso drink.', tags: ['sweet', 'creamy'] },
      { name: 'Spanish Latte', price: 2800, temp: 'both', prep: 150, milk: true, description: 'Latte sweetened with condensed milk.', tags: ['sweet', 'creamy'] },
      { name: 'Rose Spanish Latte', price: 2800, temp: 'both', prep: 150, milk: true, description: 'Spanish latte with a rose note.', tags: ['sweet', 'floral'] },
      { name: 'Spanish Saffron Latte', price: 2800, temp: 'both', prep: 150, milk: true, description: 'Spanish latte with saffron.', tags: ['sweet', 'floral'] },
      { name: 'Pistachio Spanish Latte', price: 2800, temp: 'both', prep: 150, milk: true, description: 'Spanish latte with pistachio.', tags: ['sweet', 'nutty'] },
      { name: 'Dark Caramel Latte', price: 2800, temp: 'both', prep: 150, milk: true, description: 'Latte with dark caramel.', tags: ['sweet'] },
      { name: 'Nutella Latte', price: 2800, temp: 'both', prep: 150, milk: true, description: 'Latte with Nutella.', tags: ['sweet', 'nutty'] },
      { name: 'Iced Coffee Milkshake', price: 2800, temp: 'iced', prep: 180, description: 'Coffee blended into a cold milkshake.', tags: ['sweet', 'creamy'] },
      { name: 'Strawberry Latte', price: 2800, temp: 'iced', prep: 150, milk: true, description: 'Iced latte with strawberry.', tags: ['sweet', 'fruity'] },
      { name: 'Peanut Butter Latte', price: 3200, temp: 'both', prep: 150, milk: true, description: 'Latte with peanut butter.', tags: ['sweet', 'nutty'] },
      // Not on the menu photo. It is the kickoff deck's example Drink of the Month, so it is seeded
      // with a placeholder price (our estimate, flagged unconfirmed) for the team to confirm or remove.
      {
        name: 'Caramel Cloud Latte',
        price: 3000,
        unconfirmed: true,
        temp: 'both',
        prep: 150,
        milk: true,
        description: 'Latte with caramel and a soft milk cloud on top.',
        tags: ['sweet', 'creamy'],
      },
    ],
  },
  {
    slug: 'manual-bar',
    name: 'Manual Bar',
    kind: 'drink',
    items: [
      { name: 'Aeropress', price: 2500, temp: 'both', prep: 240, description: 'Filter coffee brewed by Aeropress.' },
      { name: 'V60', price: 2800, temp: 'both', prep: 270, description: 'Pour-over filter coffee.' },
      { name: 'Chemex', price: 2800, temp: 'both', prep: 300, description: 'Pour-over brewed in a Chemex.' },
      { name: 'Iced Slow Drip', price: 2800, temp: 'iced', prep: 60, description: 'Coffee dripped slowly over ice.' },
      { name: 'Red Eye', price: 3000, temp: 'hot', prep: 120, description: 'Filter coffee with espresso added.', tags: ['strong'] },
      { name: 'Black Eye', price: 3250, temp: 'hot', prep: 120, description: 'Filter coffee with a heavier pour of espresso.', tags: ['strong'] },
      { name: 'Death Eye', price: 3500, temp: 'hot', prep: 120, description: 'Filter coffee with the most espresso of the three.', tags: ['strong'] },
    ],
  },
  {
    slug: 'tea',
    name: 'Tea',
    kind: 'drink',
    items: [
      { name: 'Black Tea', price: 2400, temp: 'hot', prep: 120, description: 'Classic black tea.' },
      { name: 'Green Tea', price: 2400, temp: 'hot', prep: 120, description: 'Green tea.' },
      { name: 'Rooibos Tea', price: 2800, temp: 'hot', prep: 120, caffeineFree: true, description: 'Rooibos, naturally caffeine free.' },
      { name: 'Hibiscus Tea', price: 2800, temp: 'hot', prep: 120, caffeineFree: true, description: 'Hibiscus herbal tea.', tags: ['fruity'] },
    ],
  },
  {
    slug: 'caffeine-free',
    name: 'Caffeine Free',
    kind: 'drink',
    items: [
      { name: 'Summer Zest', price: 1800, temp: 'iced', prep: 120, caffeineFree: true, description: 'A light, cold refresher.', tags: ['fruity'] },
      { name: 'Lavender Spritzer', price: 1800, temp: 'iced', prep: 120, caffeineFree: true, description: 'Lavender spritzer, served cold.', tags: ['floral'] },
      { name: 'Pomegranate Punch', price: 2000, temp: 'iced', prep: 120, caffeineFree: true, description: 'Pomegranate punch, served cold.', tags: ['fruity'] },
      {
        name: 'Hot Chocolate / Nutella',
        price: 2000,
        temp: 'hot',
        prep: 120,
        caffeineFree: true,
        milk: true,
        groups: ['hot-chocolate-version'],
        description: 'Hot chocolate, or the Nutella version.',
        tags: ['sweet', 'creamy'],
      },
      { name: 'Pina Colada', price: 2200, temp: 'iced', prep: 150, caffeineFree: true, description: 'Pineapple and coconut, served cold.', tags: ['fruity', 'sweet'] },
      { name: 'Mango Mango', price: 2200, temp: 'iced', prep: 150, caffeineFree: true, description: 'Mango, served cold.', tags: ['fruity', 'sweet'] },
      { name: 'Banana Chocolate-Protein Shake', price: 2200, temp: 'iced', prep: 180, caffeineFree: true, description: 'Banana and chocolate protein shake.', tags: ['sweet', 'creamy'] },
    ],
  },
  {
    slug: 'smoothies',
    name: 'Smoothies',
    kind: 'drink',
    items: [
      { name: 'Pash N Shoot', price: 2400, unconfirmed: true, temp: 'iced', prep: 180, caffeineFree: true, description: 'Passionfruit, mango, pineapple.', tags: ['fruity'] },
      { name: 'Strawberry Split', price: 2400, unconfirmed: true, temp: 'iced', prep: 180, caffeineFree: true, description: 'Strawberry, banana.', tags: ['fruity'] },
      { name: 'Tropical Colada', price: 2400, unconfirmed: true, temp: 'iced', prep: 180, caffeineFree: true, description: 'Coconut, pineapple, banana.', tags: ['fruity'] },
      { name: 'Avo Go Go', price: 2400, unconfirmed: true, temp: 'iced', prep: 180, caffeineFree: true, description: 'Mango, spinach, broccoli, avocado, coconut, lime, ginger.', tags: ['fruity'] },
      { name: 'Big 5', price: 2400, unconfirmed: true, temp: 'iced', prep: 180, caffeineFree: true, description: 'Strawberry, mango, kiwi, pineapple, apple.', tags: ['fruity'] },
      { name: 'Berry Go Round', price: 2400, unconfirmed: true, temp: 'iced', prep: 180, caffeineFree: true, description: 'Raspberry, blackberry, strawberry.', tags: ['fruity'] },
    ],
  },
  {
    slug: 'real-milkshakes',
    name: 'Real Milkshakes',
    kind: 'drink',
    items: [
      { name: 'Chocolate Milkshake', price: 2600, unconfirmed: true, temp: 'iced', prep: 210, caffeineFree: true, description: 'Made with Belgian chocolate.', tags: ['sweet', 'creamy'] },
      { name: 'Strawberry Milkshake', price: 2600, unconfirmed: true, temp: 'iced', prep: 210, caffeineFree: true, description: 'Made with real strawberry.', tags: ['sweet', 'creamy', 'fruity'] },
      { name: 'Vanilla Milkshake', price: 2600, unconfirmed: true, temp: 'iced', prep: 210, caffeineFree: true, description: 'Vanilla milkshake.', tags: ['sweet', 'creamy'] },
    ],
  },
  {
    slug: 'snacks',
    name: 'Snacks',
    kind: 'food',
    items: [
      {
        name: 'Acai Bowl',
        price: 2400,
        temp: 'none',
        prep: 240,
        caffeineFree: true,
        groups: ['acai-bowl-base', 'acai-toppings'],
        description: 'Acai bowl. Pick a base and add toppings.',
        tags: ['fruity'],
      },
      {
        name: 'Acai Smoothie',
        price: 2800,
        kind: 'drink',
        temp: 'iced',
        prep: 180,
        caffeineFree: true,
        groups: ['acai-smoothie-base'],
        description: 'Acai smoothie. Pick a base.',
        tags: ['fruity'],
      },
    ],
  },
  {
    slug: 'food',
    name: 'Food',
    kind: 'food',
    items: [
      { name: 'Assorted Muffins', price: 1200, unconfirmed: true, temp: 'none', prep: 30, caffeineFree: true, description: 'Assorted. Add a note if you have a preference.', tags: ['sweet'] },
      { name: 'Sandwiches', price: 2200, unconfirmed: true, temp: 'none', prep: 150, caffeineFree: true, description: 'Assorted. Add a note if you have a preference.' },
      { name: 'Croissants', price: 1400, unconfirmed: true, temp: 'none', prep: 90, caffeineFree: true, description: 'Assorted. Add a note if you have a preference.' },
    ],
  },
  {
    slug: 'snow-ice',
    name: 'Snow Ice',
    kind: 'food',
    items: [
      { name: 'Snow Ice', price: 2000, unconfirmed: true, temp: 'iced', prep: 210, caffeineFree: true, description: 'Assorted flavours. Add a note for the one you want.', tags: ['sweet', 'fruity'] },
    ],
  },
]

export interface SeedOption {
  name: string
  delta?: number
  isDefault?: boolean
  unconfirmed?: boolean
}

export interface SeedGroup {
  key: string
  name: string
  kind: 'single' | 'multi'
  required: boolean
  showDefault: boolean
  inlineLabel: boolean
  options: SeedOption[]
}

export const SEED_GROUPS: SeedGroup[] = [
  {
    key: 'temperature',
    name: 'Temperature',
    kind: 'single',
    required: true,
    showDefault: true,
    inlineLabel: true,
    options: [{ name: 'Hot', isDefault: true }, { name: 'Iced' }],
  },
  {
    key: 'hot-chocolate-version',
    name: 'Version',
    kind: 'single',
    required: true,
    showDefault: true,
    inlineLabel: true,
    options: [{ name: 'Hot chocolate', isDefault: true }, { name: 'Nutella' }],
  },
  {
    key: 'acai-bowl-base',
    name: 'Base',
    kind: 'single',
    required: true,
    showDefault: true,
    inlineLabel: false,
    options: [{ name: 'Banana', isDefault: true }, { name: 'Strawberry' }, { name: 'Blueberry' }],
  },
  {
    key: 'acai-smoothie-base',
    name: 'Base',
    kind: 'single',
    required: true,
    showDefault: true,
    inlineLabel: false,
    options: [{ name: 'Banana', isDefault: true }, { name: 'Strawberry' }],
  },
  {
    key: 'milk',
    name: 'Milk',
    kind: 'single',
    required: true,
    showDefault: false,
    inlineLabel: true,
    options: [
      { name: 'Regular milk', isDefault: true },
      { name: 'Oatly', delta: MILK_ALTERNATIVE_FILS },
      { name: 'Almond', delta: MILK_ALTERNATIVE_FILS },
      { name: 'Coconut', delta: MILK_ALTERNATIVE_FILS },
      { name: 'Lactose free', delta: MILK_ALTERNATIVE_FILS },
    ],
  },
  {
    // The menu lists toppings with no price. We treat them as included (AED 0) and flag them
    // unconfirmed so the team can set a real price from the menu manager later.
    key: 'acai-toppings',
    name: 'Toppings',
    kind: 'multi',
    required: false,
    showDefault: true,
    inlineLabel: false,
    options: ['Blueberry', 'Granola', 'Oats', 'Honey', 'Almonds', 'Almond Butter', 'Peanut Butter', 'Chia Seeds', 'Kiwi'].map(
      (name) => ({ name, delta: 0, unconfirmed: true }),
    ),
  },
]

/** Display order of groups on an item sheet. */
export const GROUP_ORDER = ['temperature', 'hot-chocolate-version', 'acai-bowl-base', 'acai-smoothie-base', 'milk', 'acai-toppings']

/** Weekday keys, Monday first. */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

// Every value below is a placeholder, not confirmed with Altitude, and editable in dashboard Settings.
// Opening hours default to every day so pre-orders can be demonstrated at any time.
const DEFAULT_DAY = { open: '07:00', close: '22:00', closed: false }

export const DEFAULT_SETTINGS = {
  // Drives the queue estimate.
  baristas: 2,
  // An order waiting longer than this since it joined the queue is flagged as late.
  lateAfterSeconds: 600,
  // A pre-order is late when it is still not ready this long after its pickup time.
  preorderGraceSeconds: 120,
  // Used to decide which day an order belongs to and when order numbers reset.
  timezone: 'Asia/Dubai',
  // Prep time of one typical drink, used for the "wait right now" estimate on the home screen.
  typicalDrinkPrepSeconds: 120,
  openingHours: Object.fromEntries(WEEKDAYS.map((d) => [d, { ...DEFAULT_DAY }])),
  // Pre-order slots: how long each is, how many orders each takes, how soon the first can be, how many days ahead.
  slotMinutes: 10,
  slotCapacity: 4,
  minLeadMinutes: 10,
  daysAhead: 1,
  // The sound the dashboard plays for a new order. Each device can still mute itself.
  newOrderSound: 'chime',
  // Summit Box prices come from the menu photo.
  summitBox: [
    { size: 6, priceFils: 17500 },
    { size: 10, priceFils: 25000 },
  ],
}
