# Altitude

Ordering app and store dashboard for Altitude, the specialty coffee shop at RIT Dubai. Built for the ideaForge hackathon (AIRC x Altitude).

This is **phase 1**: the foundation and the core loop. A student orders on a phone, the order appears on the counter dashboard, and every action staff take moves the tracker on the phone in real time.

## Run it

Needs Node 22 or newer.

```
npm install
npm run dev
```

| What | Where |
| --- | --- |
| Customer app | http://localhost:5173 |
| Dashboard | http://localhost:5173/dashboard |
| API | http://localhost:3000 (the web app proxies `/api` to it) |

The first start creates `data/altitude.db` and loads the menu. Nothing else to set up: with no `.env` file, demo sign-in is on.

### Dashboard logins (seeded)

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `altitude-admin` | admin |
| `barista` | `altitude-barista` | barista |

These are demo passwords. Change them with `SEED_ADMIN_PASSWORD` and `SEED_BARISTA_PASSWORD` before first start, or run `npm run seed -- --reset` after changing them.

### Demo on two devices

1. Run `npm run dev` on the laptop. Vite prints a `Network:` address such as `http://192.168.0.186:5173`.
2. Open that address on the phone (same Wi-Fi). On the sign-in screen use **Continue as demo student**. Google sign-in cannot work on a bare IP address.
3. Open `/dashboard` on the laptop or tablet and sign in as `barista`.
4. Order on the phone. The card order lands in **Live queue** straight away. Press **Start preparing**, then **Mark ready**, then **Mark collected** and watch the phone follow.
5. For the cash path, choose **Pay at counter** on the phone. The order waits in **Awaiting payment** and the phone says "Pay at the counter to start your order." until you press **Accept payment**.

If the phone cannot reach the laptop, allow Node.js through Windows Firewall for private networks.

## Environment variables

Copy `.env.example` to `.env`. Every variable the app reads is listed there.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | API server port |
| `DATABASE_PATH` | `./data/altitude.db` | SQLite file |
| `DEMO_MODE` | `true` in development, `false` in production | Shows the labelled "Continue as demo student" button |
| `GOOGLE_CLIENT_ID` | empty | Enables Google sign-in for customers |
| `ALLOWED_EMAIL_DOMAINS` | empty | Comma-separated domains allowed to sign in, for example `rit.edu`. Empty allows any Google account |
| `SEED_ADMIN_PASSWORD`, `SEED_BARISTA_PASSWORD` | see above | Passwords for the seeded dashboard accounts |
| `NODE_ENV` | `development` | `production` turns on secure cookies and trusts one proxy hop |

### Setting up Google sign-in

1. In Google Cloud Console go to **APIs & Services > Credentials** and create an **OAuth client ID** of type **Web application**.
2. Under **Authorised JavaScript origins** add:
   - `http://localhost:5173` (development)
   - `http://localhost:3000` (a production build served by the API server)
   - your public URL once you deploy, for example `https://altitude.example.com`
3. Put the client ID in `.env` as `GOOGLE_CLIENT_ID`. No client secret is needed: the browser sends an ID token and the server verifies it against Google's public keys and checks it was issued for your client ID.

Google rejects plain IP addresses as origins, so a phone opening the app at `http://192.168.x.x:5173` falls back to demo sign-in.

## What is built in phase 1

- **Design system**: dark theme by default and a light theme, chosen from the system on first visit and remembered, with no flash on load. Barlow Condensed and DM Sans are self-hosted. Colours were checked against WCAG AA for every text pairing in both themes.
- **Logo**: the four official files in `public/brand/`, copied unmodified from `reference/brand/`. `src/components/Logo.tsx` is the only place that names them, so an SVG can replace them there.
- **Auth**: Google Identity Services with the token verified on the server, the demo fallback, and a separate username and password login for the dashboard (bcrypt hashes, `httpOnly` session cookies).
- **Menu**: all 51 items from `reference/altitude_menu.txt`, with search, hot / iced / caffeine-free filters, an item sheet (temperature, milk, bases, toppings, note, quantity) and a designed fallback for items without a photo.
- **Cart and checkout**: take-away or dine-in with a table number, card (prototype) or pay at counter. Prices are always recalculated on the server from the database.
- **Order tracking**: the four-step tracker (Placed, Payment, Preparing, Ready, then Collected), queue position and estimated time, a sticky mini tracker, and live updates over Server-Sent Events. If the connection drops the app says so and polls until it returns.
- **Dashboard**: Awaiting payment, Live queue, Ready for pickup and Completed today. Actions are Accept payment, Start preparing, Mark ready and Mark collected. Order cards flag late orders in words, new orders get a chime (with a mute toggle) and a one-time highlight.
- **POS adapter**: `server/pos.ts` defines the `PosAdapter` interface and a `MockMobiposAdapter`. Every paid order goes through it and shows a receipt id on the dashboard.

### Not built yet

Pre-orders, the mood suggester, the coffee builder, events and clubs, statistics, push notifications, loyalty points and tiers, the Home page extras (drink of the month, popular picks), the menu manager, promotions, Summit Box, the dashboard settings and customer screens, ratings, the demo order simulator, the PWA install and offline mode, and deployment configuration. None of these appear in the UI.

## What is mocked or placeholder

- **Card payment**: the form is validated in the browser and then discarded. No card data is stored, logged or sent, not even to this server. To try it use `4242 4242 4242 4242`, any future date and any 3 digits.
- **MOBIPOS**: no API access or documentation exists, so the adapter only logs and returns fake receipt ids. See below for where the real integration plugs in.
- **Placeholder prices**: 13 items had no price on the menu photo (smoothies AED 24, real milkshakes AED 26, muffins AED 12, sandwiches AED 22, croissants AED 14, snow ice AED 20). These figures are our estimates, not Altitude's prices. They are flagged `price_unconfirmed` in the database. Acai toppings are treated as included (AED 0) and flagged the same way.
- **Prep times, temperature tags and descriptions** are our own working values. The queue estimate depends on the prep times, so replace them with timed real orders.
- **Shop settings**: 2 baristas, a 10 minute "late" threshold and opening hours are placeholders in the `settings` table. Opening hours are not enforced yet.
- **Menu photos**: none supplied. Every item shows the fallback panel until you add `public/images/menu/<slug>.jpg` (the slug is the item name in lower case with dashes, for example `cafe-latte.jpg`). `.png` and `.webp` also work. No restart needed.
- **Sold out**: items can be marked sold out and the app handles it, but there is no screen to do it yet. Until the menu manager exists, set `sold_out = 1` on the item in the database.

## Plugging in the real MOBIPOS

Everything the app needs from the POS is in `server/pos.ts`:

```ts
interface PosAdapter {
  createOrder(order): Promise<{ posOrderId: string }>
  markPaid(posOrderId, payment): Promise<{ receiptId: string }>
  voidOrder(posOrderId, reason): Promise<void>
}
```

Write a class that implements it against the MOBIPOS API (for example `server/pos-mobipos.ts`) and change the last line of `server/pos.ts` to export that class instead of `MockMobiposAdapter`. `createOrder` and `markPaid` are called when an order is placed (card) and when staff accept a cash payment. A POS outage never loses an order: the order is saved first and the sync failure is logged.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API and web app together, with reload |
| `npm test` | Unit tests: queue ordering, estimated time, cash-payment gating, server-side pricing |
| `npm run typecheck` | Type-checks the web app and the server |
| `npm run build` | Type-checks and builds the web app into `dist/` |
| `npm start` | Runs the API server, which also serves `dist/` if it exists |
| `npm run seed -- --reset` | Wipes the database and seeds it again |

If `better-sqlite3` fails to load after an install on a new Node version, run `npm rebuild better-sqlite3`.

## Project layout

```
shared/    types, money, order flow and wording used by both sides
server/    Express API, SQLite schema and seed, realtime, POS adapter
  domain/  pure logic with tests: queue, ETA, order state machine, pricing
src/       React app: customer screens, dashboard screens, design tokens
public/    brand logos, menu photos, static files
reference/ source material: menu transcript, brand files, cafe photos
```

Design decisions live in `PRODUCT.md` and `DESIGN.md`.
