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
