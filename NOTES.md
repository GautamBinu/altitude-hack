# Build notes

Decisions made while building everything after phase 1, in the order the work was done. Each part ends
with a type check, the tests and a git commit. Nothing here needed a question to be asked; where the brief
left a choice open, the choice and the reason are written down so the team can change it.

## Working rules used throughout

- Money is integer fils. The server prices every order itself from the database. The browser never sends a price.
- Nothing is shown in the UI unless it is built. No dead buttons.
- Everything synthetic is marked synthetic: seeded students, clubs, events, promotions, the sample discount code
  and 30 days of order history are not Altitude's data.
- Anything that is an estimate of ours rather than a fact from Altitude is flagged `unconfirmed` in the database
  and listed in the README.

## Part 1: seed data and loyalty

- **History**: about 750 orders over 30 days from a seeded random generator, so every fresh database is the same.
  Weekday lunch (12 to 14) and mid-afternoon (15 to 16) peaks, a lighter weekend, an exam-week surge, 72% card
  and 28% cash, a bias toward the espresso bar and iced drinks, about 8% pre-orders, ratings on about a third of
  orders. Roughly 6% of orders are late, with a few rushes. Caramel Cloud Latte only has sales for the last 10
  days, because it is the new Drink of the Month.
- **Students**: 24 invented first names plus the demo student (Aisha), who is seeded with about 20 orders and
  exactly 1,240 points (Gold, 260 to Platinum), the deck's example. Students are skewed so a few are regulars and
  most are occasional, which spreads the tier mix from Bronze to Platinum.
- **Tier is decided by lifetime points earned**, not by balance, so spending points on a reward never drops a
  member down a tier. Thresholds 0 / 500 / 1,000 / 1,500 and multipliers 1.0 / 1.1 / 1.25 / 1.5 are settings.
- **Points** are 1 per AED actually paid (after any reward), multiplied by the tier's multiplier at the moment of
  collection and rounded down. They are awarded once, when the order is marked collected, and written to a ledger
  (`loyalty_ledger`) so history, balance and tier can always be explained.
- **Perks** are only the ones that are real: the bonus points multiplier and the rewards each tier unlocks. The
  brief's examples (free upsize, birthday drink, early access) are not built, so they are not promised.
- **Rewards**: AED 5 off for 100 points, AED 15 for 250 (Silver), AED 30 for 450 (Gold), AED 60 for 800
  (Platinum). One reward per order. Points are spent when the order is placed and returned if it is cancelled.
- **Schema changes are additive.** The database upgrades itself on start: new tables and columns are added, the
  old `orders` table is rebuilt (rows copied across) because SQLite cannot change a CHECK constraint, and each
  seed step runs once, tracked by `seed:*` keys in the settings table. Existing orders, accounts and edits are
  never touched.
- **Caramel Cloud Latte** is on the menu at a placeholder AED 30, flagged unconfirmed. It is not on the menu photo.

## Part 2: home screen

- **One public endpoint** (`GET /api/home`) returns the Drink of the Month, up to two banners, Popular on campus
  for both windows, and the next three events. Signed-in members also get `GET /api/me/usual`.
- **Popular on campus** counts units ordered from real order history (everything except cancelled orders). "Today"
  means since midnight in the shop's timezone. Early in the day, before three items have sold, it quietly switches
  to the last 24 hours and the tab says "24 hours" so the numbers are never misleading.
- **Your usual** is the line the member has ordered most (same item, same choices, same note), and only appears after
  they have ordered it at least twice. "Last order" repeats every line of their most recent order. Items that are
  sold out or gone are left out and the member is told.
- **Layout**: laptop and wider is a main column (greeting, live order, Drink of the Month, popular, usual) beside a
  side column (full logo panel, loyalty card, banners, events). Tablets get a slim logo band across the top. Phones
  use the chain-link mark in the header and skip the logo panel, as DESIGN.md says.
- **Drink of the Month** shows "Here until <date>" as a plain fact. There is no countdown, which DESIGN.md rules out.
- **Entry points** to the mood suggester and the builder, and the link from the events preview to the events hub, are
  added in the parts that build those pages, so nothing on the home screen is a dead link.
- **One-tap reorder** also lives on order history and on a collected order's page.

## Part 3: menu manager and promotions

- **Who can do what.** Admins change names, prices, descriptions, photos, tags, prep times, choices, the builder, the
  Summit Box and promotions. Baristas can open the menu and mark items sold out, because "we ran out of oat milk" is a
  counter job, and nothing else. This is enforced on the server, not just by hiding buttons.
- **Edits reach customers immediately.** Every change is announced on a small public live channel
  (`/api/stream/public`). Open apps, signed in or not, fetch the menu and home screen again within a moment.
- **Price snapshots.** Each order line stores the item's name and the price it was sold at, so changing or deleting
  an item never changes an old order. This is covered by a test: an order is placed, the price is changed, a second
  order is placed, and the first still shows the old price.
- **Setting a price confirms it.** Items with a placeholder price carry an "Unconfirmed price" label. Saving a new
  price clears the label, and there is a filter that lists every unconfirmed price.
- **Choices are shared.** Milk alternatives, acai bases and toppings are option groups. Change Oatly from AED 6 to
  AED 7 once and every milk drink changes. Options are updated in place by id, so saved carts and favourites keep
  working. A choice that an item still uses cannot be deleted.
- **Temperature is automatic.** Marking an item "hot or iced" adds the temperature choice; any other setting removes it.
- **Pictures.** The browser shrinks a picture to at most 1200 px before uploading. The server checks the first bytes
  of the file (not the label the browser gives it), caps the size, and saves it under a random name in `UPLOAD_DIR`
  (default `data/uploads`). Only addresses under `/uploads` or `/images` can be set as a picture, so no outside URL can
  be injected. On a host with a disk, point `UPLOAD_DIR` at the disk.
- **Drink of the Month** has a last day, after which it stops showing on its own. **Banners** can have a first and
  last day; the home screen shows the first two that are active.
- **Discount codes** take a percentage or a fixed amount off, with optional dates and a use limit. The order of
  discounts is fixed and tested: Summit Box value, then code, then reward points. Cancelling gives a use back.
- A bug found while testing: an update of only the price was resetting the description, tags and choices because of
  how the request schema applied defaults. Fixed, with a regression check.

## Part 4: pre-orders

- **Two ways to order.** "As soon as possible" is unchanged. "Pick a time" shows 10 minute pickup slots for today and
  tomorrow. Each slot takes 4 orders (`slotCapacity`), the earliest slot is 10 minutes away (`minLeadMinutes`), and
  all of these are settings, not constants. The slot is checked again inside the same transaction that saves the order,
  so two people cannot take the last place at once. Collected orders keep their slot; cancelled ones give it back.
- **Opening hours are a placeholder.** Every day 07:00 to 22:00, because the real hours are not in the repo and the
  demo has to work at any time of day. They are editable in the database now and in Settings in Part 9. ASAP orders
  are not blocked by hours; only pre-order slots follow them.
- **Scheduled lane.** A paid pre-order has the status `scheduled` until it is due to start: pickup time minus the
  order's prep time (`due_at`). The server moves it to `queued` itself (checked every 5 seconds). Staff can also press
  "Start now" to begin one early.
- **Queue position.** The queue is ordered by `queue_at`. For an ASAP order that is the moment it was confirmed. For a
  pre-order it is `due_at`, so it lands behind everything confirmed before it was due and ahead of everything after.
  This keeps the existing "first in, first made" rule with no special case.
- **ETA for a pre-order** comes from `forecastScheduled`, which replays the queue and the other pre-orders against
  the number of baristas. The checkout says "Ready at 08:00", or "It's busy, so it may be ready N minutes late" when
  the simulation cannot make the pickup time. It never promises an earlier time than the slot.
- **Cash pre-orders are allowed.** They sit in Awaiting payment (showing the pickup time) until staff accept the cash.
  Accepting puts them on the Scheduled lane, or straight into the queue if they are already due.
- **Late flag.** An ASAP order is late after `lateAfterSeconds` in the queue. A pre-order is late only when it is not
  ready by pickup time plus `preorderGraceSeconds` (120 s), so one that starts early is never marked late.
- **Cancelling** needs a reason (shown to the customer). It works from any state before Collected. Points spent on
  the order go back, a discount code's use is given back, and the POS order is voided. "Refund" only applies to a paid
  card order; asking for a refund on an unpaid one just cancels it. The server ignores the flag rather than erroring.
- **Kitchen display** is a toggle on the Orders screen: type 125 percent, navigation hidden, Completed lane hidden.
- **Completed today** shows the latest 10 with "Show all", so a busy day does not push the live lanes off the page.
- **Phone layout.** The dashboard shows one lane at a time with a tab per lane. Laptop and wider show three columns.

## Part 5: "What are you in the mood for?"

- **The local scorer is the product; the model is an optional upgrade.** `server/domain/mood.ts` reads the text, scores every
  menu item by its tags, and picks three. It needs no network and no key, so the feature always works, including on a
  laptop with no internet at the demo.
- **How the text is read.** `server/domain/moodLexicon.ts` is a list of rules: phrases such as "rainy", "finals week" or
  "dont like sweet" mapped to tags to look for and tags to avoid. Longer phrases win ("cold brew" is a drink, "cold
  outside" is weather). A "not" before a phrase flips it within its clause ("sweet but not heavy" wants sweet and
  light), and a negated situation ("not raining") is ignored. Taste words the customer names count more than moods and
  weather, so "tired, but I want something sweet" still gets sweet drinks, with caffeine as a tie-breaker.
- **Hard rules.** No caffeine, decaf or "cant sleep" returns only caffeine-free drinks. A limit such as "under 25 AED" returns
  only drinks at or under it, or the cheapest few with a note when nothing fits. Food is only suggested when the text asks.
  Sold-out and hidden items are never suggested. Hot or iced is passed on, so "Add to order" picks the right temperature.
- **Tags.** Every seeded item now has mood and flavour tags (`server/seed-mood.ts`), added to an existing database once by the
  `mood-tags` seed step without removing tags the team set. They are our own reading of the menu, not Altitude's. In the
  dashboard, Menu, edit an item, Tags: a tap-to-toggle list of the words the suggester understands sits under the text box.
  `milk-free` is only on items that are plainly milk-free from their description (espresso, filter coffee, tea). Nothing
  claims "vegan" or "dairy free".
- **One-line reasons** are written from the tags the item really has, never from the text alone: "Caramel and sweet, for a rainy
  day." Each pick leads with what sets it apart, so three picks do not repeat the same line. When a request cannot be
  read, the reason is how many times the drink was ordered this week.
- **The model path** (`ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`, default `claude-haiku-4-5`). The menu and the customer's
  text go to the Messages API with a system prompt that says the text is data. The reply must be JSON; every pick is checked
  against the real, available menu, reasons are cleaned (no emoji, one line), and duplicates or unknown ids are dropped. If
  fewer than three survive, the local scorer fills the rest. A timeout (8 s), an error or a nonsense reply silently falls back
  to the local scorer. The response never says which engine answered, and the UI has no "AI" label. **The live model call
  has not been run**, because there is no key in this workspace. The prompt builder, reply checker and fallback are
  covered by unit tests with a stand-in model. Only Anthropic is wired up.
- **Abuse.** Open to guests, limited to 40 requests per 10 minutes per address, text capped at 300 characters, no text stored.
- **Where it shows up.** A box on the home screen (leads to `/mood?q=...`), a link at the top of the menu, and the page itself with
  a rotating example in the empty box and four "Try" phrases. Results are one large card and two smaller ones, each with
  Add to order and Choose options. Menu items have no photos yet, so cards show the mountain panel until the team adds them.
