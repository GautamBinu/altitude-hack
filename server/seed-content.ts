/**
 * Synthetic content for the demo. None of this is real: the students are invented first names, the
 * clubs and events are samples that do not speak for any real RIT Dubai club, and the promotions are
 * examples of what marketing can set up. Everything seeded here is marked `is_sample` where a screen
 * could mistake it for the real thing.
 */

/** About 25 demo students: first names only, no surnames, no emails. */
export const STUDENT_NAMES = [
  'Omar', 'Layla', 'Yusuf', 'Mariam', 'Karim', 'Noor', 'Sara', 'Hamad', 'Fatima', 'Zayed',
  'Dana', 'Ravi', 'Priya', 'Arjun', 'Meera', 'Ali', 'Huda', 'Tariq', 'Leena', 'Faisal',
  'Rania', 'Imran', 'Sana', 'Khalid',
]

/** The student behind "Continue as demo student". Seeded with a history so the home screen has something to show. */
export const DEMO_STUDENT = { sub: 'demo:student', name: 'Aisha (demo student)', firstName: 'Aisha' }

export interface SeedBuilderOption {
  kind: 'base' | 'flavour' | 'shot' | 'topping' | 'sweetness'
  name: string
  /** Fils. A base's price is the starting price of the drink; the rest are add-ons. */
  price: number
  /** Warm tint used by the cup illustration. */
  color?: string
  temperature?: 'hot' | 'iced' | 'both'
  usesMilk?: boolean
  prep?: number
  unconfirmed?: boolean
}

export const SEED_BUILDER: SeedBuilderOption[] = [
  // Bases. Espresso, Americano, Latte and Flat White take their price from the menu; the other two are estimates.
  { kind: 'base', name: 'Espresso', price: 2000, color: '#3b2418', temperature: 'hot', prep: 45 },
  { kind: 'base', name: 'Americano', price: 2000, color: '#4a2f1f', temperature: 'both', prep: 75 },
  { kind: 'base', name: 'Latte', price: 2500, color: '#a9825d', temperature: 'both', usesMilk: true, prep: 120 },
  { kind: 'base', name: 'Flat white', price: 2500, color: '#9a7350', temperature: 'hot', usesMilk: true, prep: 120 },
  { kind: 'base', name: 'Cold brew style', price: 2800, color: '#2c1a10', temperature: 'iced', prep: 60, unconfirmed: true },
  { kind: 'base', name: 'Manual brew', price: 2800, color: '#5a3a24', temperature: 'both', prep: 270 },
  // Flavours. The add-on prices come from the gap between a plain latte and the flavoured lattes on the menu.
  { kind: 'flavour', name: 'Spanish', price: 300, color: '#c9a36a', usesMilk: true },
  { kind: 'flavour', name: 'Rose', price: 300, color: '#c98f86', usesMilk: true },
  { kind: 'flavour', name: 'Saffron', price: 300, color: '#d8a444', usesMilk: true },
  { kind: 'flavour', name: 'Pistachio', price: 300, color: '#a3a46b', usesMilk: true },
  { kind: 'flavour', name: 'Dark caramel', price: 300, color: '#8a5a2b', usesMilk: true },
  { kind: 'flavour', name: 'Nutella', price: 300, color: '#6b4430', usesMilk: true },
  { kind: 'flavour', name: 'Peanut butter', price: 700, color: '#b88a4e', usesMilk: true },
  { kind: 'flavour', name: 'Strawberry', price: 300, color: '#c8665c', temperature: 'iced', usesMilk: true },
  // Extra shot, sweetness and toppings are not priced on the menu photo: estimates for the team to confirm.
  { kind: 'shot', name: 'Extra shot', price: 400, color: '#2b1a10', prep: 20, unconfirmed: true },
  { kind: 'sweetness', name: 'No sugar', price: 0 },
  { kind: 'sweetness', name: 'Light', price: 0 },
  { kind: 'sweetness', name: 'Regular', price: 0 },
  { kind: 'sweetness', name: 'Extra sweet', price: 0 },
  { kind: 'topping', name: 'Whipped cream', price: 300, color: '#f1e9dc', unconfirmed: true },
  { kind: 'topping', name: 'Cocoa dust', price: 200, color: '#5a3a28', unconfirmed: true },
  { kind: 'topping', name: 'Cinnamon', price: 100, color: '#a8683a', unconfirmed: true },
  { kind: 'topping', name: 'Crushed pistachio', price: 300, color: '#8d9a5a', unconfirmed: true },
]

export interface SeedPost {
  kind: 'event' | 'post'
  title: string
  club: string
  body: string
  /** Days from now. Negative is in the past. */
  dayOffset?: number
  hour?: number
  place?: string
  status: 'approved' | 'pending'
  author: string
}

/** Sample posts for invented clubs. */
export const SEED_POSTS: SeedPost[] = [
  {
    kind: 'event',
    title: 'Sunset photo walk',
    club: 'Photo Walk Collective',
    body: 'An easy walk around campus as the light turns gold. Bring any camera, a phone is fine.\n\n- Meet at the main entrance\n- About an hour\n- All levels welcome',
    dayOffset: 2,
    hour: 17,
    place: 'Main entrance',
    status: 'approved',
    author: 'Photo Walk team',
  },
  {
    kind: 'event',
    title: 'Board game night',
    club: 'Chess and Board Games',
    body: 'Chess boards, card games and a few big strategy games. Learn something new or bring your own.\n\n**Free to join.** Games are provided.',
    dayOffset: 4,
    hour: 18,
    place: 'Altitude, back tables',
    status: 'approved',
    author: 'Board games team',
  },
  {
    kind: 'event',
    title: 'Pitch practice evening',
    club: 'Entrepreneurship Circle',
    body: 'Practise a two-minute pitch in front of friendly listeners and get notes you can use. Ideas at any stage are welcome.\n\nBring a one-line version of your idea.',
    dayOffset: 7,
    hour: 16,
    place: 'Seminar room',
    status: 'approved',
    author: 'Entrepreneurship team',
  },
  {
    kind: 'event',
    title: 'Short film screening',
    club: 'Film Night',
    body: 'Four short films from members, followed by a relaxed chat. Popcorn is on us.',
    dayOffset: -6,
    hour: 19,
    place: 'Lecture hall',
    status: 'approved',
    author: 'Film Night team',
  },
  {
    kind: 'post',
    title: 'Looking for a route-setting buddy',
    club: 'Climbing and Hiking Crew',
    body: 'We are planning a weekend trail day and need two people to scout the route. If you like maps and early mornings, say hello at the counter or message the crew.',
    dayOffset: -2,
    status: 'approved',
    author: 'Climbing crew',
  },
  {
    kind: 'event',
    title: 'Coffee tasting with the baristas',
    club: 'Film Night',
    body: 'Collab idea: a quiet tasting of three brews before the screening. Waiting for approval.',
    dayOffset: 9,
    hour: 15,
    place: 'Altitude',
    status: 'pending',
    author: 'Film Night team',
  },
]

export interface SeedPromo {
  title: string
  body: string
  /** Slug of the menu item the banner points to. */
  itemSlug?: string
}

export const SEED_PROMOS: SeedPromo[] = [
  { title: 'Spanish latte family', body: 'Plain, rose, saffron or pistachio. Same smooth base.', itemSlug: 'spanish-latte' },
  { title: 'Order for the gap between classes', body: 'Pick a pickup time at checkout and we will have it ready.' },
]

export const SEED_CODE = { code: 'BASECAMP10', kind: 'percent' as const, value: 10 }

export const SEED_REVIEW_COMMENTS = [
  'Ready right when the app said.',
  'Good flat white, quick pickup.',
  'Table service was quick.',
  'Wish the queue estimate was a bit shorter, but it was accurate.',
  'Nice latte.',
  'Smoothie was fresh.',
  'Order was right.',
  'A little slow at lunch.',
]
