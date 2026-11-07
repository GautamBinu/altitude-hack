# Build brief: Altitude coffee shop web app (customer app + store dashboard)

You are building a complete, working, demo-ready web app for **Altitude**, a specialty coffee shop on the RIT Dubai campus. It is a hackathon entry (ideaForge, run by AIRC x Altitude). Judges score it on: Solution Fit 25%, Innovation & Creativity 20%, Technical Execution 20%, Design & Experience 20%, Pitch & Feasibility 15%. The prototype must be submitted by Sunday 8 Nov, 12 PM, so prioritise a polished, fully working core over half-finished extras. Build in the priority order at the end of this brief.

Attached: `altitude_menu.txt` (full menu with prices, use it as seed data), photos of the cafe interior (use them as the design reference), and the kickoff deck (summarised below).

## 1. What the organisers asked for (all must be covered)

1. **Loyalty rewards**: points and tiers that reward students on every order.
2. **Order and queue**: take-away or table orders, live queue position ("3 ahead of you"), and an alert when the order is ready.
3. **Popular picks**: best-selling drinks and food, driven by real order history.
4. **Promo spotlight**: marketing can feature a Drink of the Month and promotions.
5. **Club and event hub**: a space for RIT clubs and communities to share events and collabs.
6. **Online payments**: pay online, designed to integrate with Altitude's POS system, **MOBIPOS** (mock it behind an adapter, see section 6).

The deck's sample home screen shows: a time-of-day greeting, loyalty tier and points ("Gold tier, 1,240 pts, 260 pts to Platinum"), an active order card ("Order #27, 3 ahead of you, we'll alert you when it's ready"), Drink of the Month ("Caramel Cloud Latte, try it before it's gone"), and Popular Now (Iced Latte, Cold Brew, Croissant). That is an illustration, not a spec. Match its spirit, do not copy its layout.

## 2. Stack and architecture

- **Frontend**: React + TypeScript + Vite, Tailwind with fully custom design tokens (do not ship default Tailwind or shadcn looks), React Router, installable **PWA** (manifest, service worker, offline app shell).
- **Backend**: Node + Express (TypeScript) with SQLite (better-sqlite3 or Drizzle). One server serves the API, the built frontend, and realtime updates via **Server-Sent Events** (or WebSocket). Order status changes must appear instantly on both the customer's phone and the dashboard.
- **Auth**:
  - Customers: **Google Sign-In** (Google Identity Services, ID token verified on the server). Read `GOOGLE_CLIENT_ID` from env. Optional `ALLOWED_EMAIL_DOMAINS` env to restrict sign-in. When `DEMO_MODE=true`, also show a clearly labelled "Continue as demo student" button so the app still demos without Google credentials. Guests can browse the menu and events but must sign in to order, earn points, or submit blogs.
  - Dashboard: **simple username + password** on a separate `/dashboard` login. Passwords hashed (argon2/bcrypt), httpOnly session cookie. Seed `admin` and `barista` accounts, print the credentials in the README.
- **Config**: `.env.example` with every variable. Opening hours, number of baristas, slot length, and slot capacity are settings editable in the dashboard, not hardcoded.
- Must run with `npm install && npm run dev` and be deployable as a single service (Render/Railway/Fly). Write a README with run, seed, deploy and demo steps.

## 3. Design direction (very important)

**Reference**: the attached cafe photos and menu. The space is warm and calm: sand/cream plaster walls, pale oak wood with a round-dimple panel pattern, matte black track lighting, long curved black light bands with a warm glowing edge, backlit signage, mountain-layer artwork on the menu, and the official Altitude logo (an arched navy ALTITUDE wordmark above a bicycle chain-link mark with a small peak inside). The tagline on the wall is "Elevate your experiences". The feeling is a modern, slightly premium study cafe, not a tech startup.

**Palette (tune to hit WCAG AA)**
- Dark mode (default): warm charcoal, not pure black. Background about `#141210`, surface `#1D1A17`, raised `#27221E`, text `#F1E9DC`, muted text `#B5A998`, accent warm amber `#E8B26A` (the LED glow), brand navy `#082855` (sampled from the logo) used for badges and brand panels.
- Light mode: sand/cream background about `#EFE7DA`, surface `#F8F3EA`, oak `#C69A63` as secondary, navy as primary action, near-black text.
- Theme toggle in the header, remembers choice, respects `prefers-color-scheme` on first visit, no flash on load.

**Typography**: a condensed bold display face for headings and prices (Barlow Condensed or similar, echoing the menu headers and logo), a clean humanist sans for body (DM Sans or Figtree). Do not use Inter, Roboto, Poppins or system default stacks. Self-host fonts (no runtime CDN dependency).

**Motifs to reuse with restraint**: the chain-link mark from the logo (only as the supplied files), the curved glowing line (as section dividers and the progress tracker track), the dimple-circle pattern (very low contrast, as background texture), layered mountain silhouettes (empty states, loyalty tiers), subtle paper grain. Altitude vocabulary is welcome in microcopy: "summit", "climb", "base camp".

**It must not look AI-generated. Hard rules:**
- **No emojis anywhere**: not in UI, copy, toasts, seed data, or the README. No emoji-style glyphs either.
- Icons: one consistent line icon set (Lucide or Phosphor, single stroke weight), used only where they carry function (navigation, buttons, status). Never decorative icons above headings, never icon-in-a-circle feature grids.
- No purple/blue-violet gradients, no gradient text, no glassmorphism blobs, no neon glows, no floating orbs, no "sparkle" icon for the mood feature, and no "AI-powered" labelling.
- No three identical rounded cards with icon, title and paragraph. Vary scale and layout: large type, full-bleed imagery, asymmetric compositions, real hierarchy. Consistent small corner radius (6 to 10px), not pill-everything.
- Copy is short, specific and written like a barista would say it: "Two ahead of you. About 6 minutes." not "Your order is being processed!". No lorem ipsum, no "Welcome to the future of coffee", no filler superlatives.
- Photography-led. Each menu item has an `image` field. Load real images from `/public/images/menu/<slug>.jpg` (the team will drop photos in); until a file exists, show a consistent, tasteful fallback (duotone tone-on-tone panel with the item name set in the display face), never a broken image or a grey box. Dashboard can upload an image per item.
- **Logo: use the official logo files in `/public/brand/`, never recreate or restyle them.** They are `altitude-logo-navy.png` and `altitude-logo-cream.png` (full logo, transparent background) and `altitude-mark-navy.png` and `altitude-mark-cream.png` (chain-link mark only). Cream on dark backgrounds, navy on light, swapping with the theme. Use the full logo on the splash/loading screen, both login screens, the order confirmation, and the home header on tablet and laptop; use the mark alone for the phone header, the dashboard sidebar, the favicon, the PWA icons and notification icon. Put it on a solid panel, never over a photo, with clear space around it. These are PNGs made from a small source image, so structure the code so an SVG can be dropped in later without other changes.
- Motion: purposeful and quiet (short ease-out transitions, a drawn checkmark, a tracker that fills). Respect `prefers-reduced-motion`.

**Responsive**: designed for phone, tablet and laptop, tested at 375, 768, 1024 and 1440 px.
- Customer app: mobile-first. Bottom tab bar on phones; side rail or top nav with a two-column layout on tablet and laptop (for example menu plus cart side by side). Touch targets at least 44px. Safe-area insets respected.
- Dashboard: tablet-first (it will live on a counter tablet) while fully usable on laptop and phone. Sidebar collapses to a bottom bar or drawer on small screens.

## 4. Customer app

**Home** (welcoming, not a wall of cards)
- Time-of-day greeting with first name. Loyalty summary: points, tier, and progress to the next tier, with a mountain-climb progress visual.
- If an order is active, a persistent order tracker card at the top (live, links to the order screen).
- **Drink of the Month** hero (set from the dashboard promotions tab), plus up to two other active promos.
- **Popular on campus**: trending items computed from real order history (last 24h and 7 days toggle), showing "ordered N times today". Also show "Your usual" quick reorder for returning users.
- Entry points to "What are you in the mood for?" and "Build your own".
- Upcoming events preview.

**Menu and ordering**
- Categories from `altitude_menu.txt`. Search, filter (hot/iced, caffeine free), sold-out state controlled by the dashboard.
- Item sheet: temperature, milk (Oatly/Almond/Coconut/Lactose Free, +AED 6 or whatever the dashboard says), size or variant where relevant, acai bowl base and toppings, note to barista, quantity.
- Cart with full price breakdown, loyalty redemption, and Summit Box bundles (6 for AED 175, 10 for AED 250) as a purchasable pass with a remaining-drinks counter that can be used at checkout.
- Fulfilment: **Take-away** or **Dine-in** (with table number).
- **Order now or pre-order**: "As soon as possible" or pick a pickup time from time slots (slot length and per-slot capacity configurable; full slots disabled; only within opening hours).
- Favourites and order history with one-tap reorder.

**"What are you in the mood for?"**
- A single free-text box ("rainy, tired, need something sweet but not heavy"). Return 3 suggestions, each with a photo, the drink name, price, an add-to-cart button, and **one short line** explaining why it fits.
- Implementation: every menu item carries mood/flavour/caffeine/temperature tags. Backend scores items against the text. If `ANTHROPIC_API_KEY` (or another LLM key) is set, use the model to interpret the text against the menu and write the one-liners, constrained to JSON output and to real menu items only; otherwise fall back to a local keyword/tag scorer so it always works offline. Never suggest sold-out items. No chat UI, no long paragraphs.

**Create your own coffee**
- A guided builder: base (espresso, americano, latte, flat white, cold brew style, manual brew), hot or iced, milk, flavour (Spanish, rose, saffron, pistachio, dark caramel, Nutella, peanut butter, strawberry, as on the menu), extra shot, sweetness, topping. A live cup illustration updates with the choices, price updates live (all option prices editable in the dashboard), and the user names their creation.
- Save to favourites, add to cart, and optionally submit to the community board of creations (shown on the home or menu page, moderated in the dashboard). Position this as the way to win a team-named signature drink.

**Checkout and payment**
- Choose **Card** or **Pay at counter**.
- Card is a prototype: card form with formatting and validation, then a processing animation, then a drawn-checkmark success animation, then straight to the order screen. No real card data is ever stored or sent; make that explicit in code comments.
- Pay at counter: order is placed but marked unpaid.

**Order screen and tracking**
- A minimal **4-step progress bar**: Placed, Payment, Preparing, Ready (then Collected as the final state).
  - Card order: Payment completes instantly.
  - Cash order: the tracker **stops at step 2** with the text "Pay at the counter to start your order" until staff approve the payment in the dashboard; only then can it advance.
- Show the order number, items, fulfilment type, pickup time for pre-orders, **queue position** ("2 ahead of you") and a live **estimated time** ("Ready in about 6 min", or "Pickup at 1:30 PM" for pre-orders). Estimate = (prep time of orders ahead / number of baristas) + this order's prep time, using per-item prep times that the dashboard can edit.
- A QR code of the order number to show at the counter.
- **Notifications**: PWA with Web Push (VAPID) plus the Notification API. Request permission after the first order is placed, not on page load. Each status change updates one persistent notification (same `tag`) in the form `Order #27 | Step 2 of 4: Preparing` with the ETA as the body, and a clear alert when the order is ready. Browsers cannot render a native progress bar inside a notification, so represent progress in the text and keep the full visual bar inside the app. Include a sticky in-app mini tracker on every screen while an order is active. Add iOS note in README (must be added to Home Screen).
- Rating prompt after collection (1 to 5 stars plus optional comment), shown in dashboard stats.

**Loyalty**
- Tiers: Bronze (0), Silver (500), Gold (1,000), Platinum (1,500) points, thresholds configurable. 1 point per AED spent, with a tier multiplier. Perks per tier (for example a free upsize, a birthday drink, early access to Drink of the Month). Points are awarded when an order is marked collected. Points history, rewards to redeem for a discount at checkout, and a clear tier progress view.

**Events and clubs hub**
- Public feed of approved posts: title, club or community, date and place (if an event), cover image, body, "I'm interested" count. Filter by upcoming, past and club.
- **Anyone can submit** a post or blog (signed-in users, plus guests with a name field) through a simple form with image upload and a rich-text or markdown body. Submissions are saved as **pending** and are invisible to the public until a dashboard user approves them. Submitters see "Pending review" status. Spam protection: rate limit, size limit, sanitise all HTML/markdown.

**Profile**: account, loyalty, favourites, past orders, saved creations, notification settings, theme.

## 5. Store dashboard (`/dashboard`)

Login with username and password. Real-time, with a sound and visual alert for new orders. Sections:

1. **Orders / Queue** (the main screen, kitchen-friendly)
   - Lanes: **Awaiting payment** (cash orders), **Live queue**, **Scheduled** (pre-orders), **Ready for pickup**, **Completed today**.
   - Cash orders sit in Awaiting payment until staff press **Accept payment**; only then do they enter the queue and the customer's tracker moves on.
   - Card orders enter the live queue immediately.
   - Actions per order: Start preparing, Mark ready, Mark collected, Cancel (with reason, and refund flag for card).
   - **Queue order** = by target ready time. "Now" orders are ordered by the time they were confirmed. Pre-orders are placed at their pickup time: they stay in Scheduled and automatically slot into the live queue at the correct position when `pickup time minus prep time` arrives, with a "due to start" countdown. Highlight orders that are running late. Show each order's items with modifiers and notes, customer first name, table number or take-away, payment status, and time waiting. A bigger "kitchen display" mode with large type for the counter tablet.
2. **Menu manager**: create, edit, hide, mark sold out, reorder, delete for **every** item and category, including the name, price, description, image upload, tags (mood, caffeine, hot/iced), prep time, milk alternatives, builder options (bases, flavours, toppings), and Summit Box prices. Changes apply instantly to the customer app. Orders keep a snapshot of the name and price at the time of purchase. Items with placeholder prices are flagged "unconfirmed".
3. **Promotions**: set the **Drink of the Month** (item, headline, short copy, image, end date), manage promo banners and optional discount codes with start and end dates.
4. **Events moderation**: pending queue with preview, approve, reject (with a reason shown to the submitter), edit before approving, unpublish; also moderation of community coffee creations.
5. **Statistics** (date range: Today, 7 days, 30 days; default Today, with comparison to yesterday or last week): revenue, order count, average order value, average prep time, peak hours chart (orders per hour), top items (bar chart) with the most popular drink and snack called out, category split, card vs cash split, now vs pre-order split, new vs returning customers, loyalty points issued and tier mix, queue length over the day, late order rate, average rating, slowest and least popular items, and CSV export. Use a chart library (Recharts or Chart.js) themed to the design tokens.
6. **Customers and loyalty**: searchable list, points, tier, order count, manual points adjustment, loyalty settings.
7. **Settings**: opening hours, slot length and capacity, number of baristas, tier thresholds, notification sound, staff accounts (add or remove), POS integration status panel.

## 6. POS integration (MOBIPOS)

Create a `PosAdapter` interface (create order, mark paid, void) with a `MockMobiposAdapter` implementation that logs and returns fake receipt IDs. Every paid order calls the adapter. The dashboard shows a "POS sync: connected (demo)" status and a receipt ID per order. Document in the README exactly where the real MOBIPOS API would plug in. This is a key point for the Pitch and Feasibility score.

## 7. Data, demo and quality

- **Seed script**: the full menu from `altitude_menu.txt`, 30 days of realistic synthetic order history (lunch and mid-afternoon peaks, exam-week spikes, a mix of card and cash, drink and snack bias toward the espresso bar and iced drinks) so Popular Picks and Statistics look alive on first run; 25 or so demo students (first names only, no real data); sample approved and pending event posts for 4 to 5 RIT clubs; a Drink of the Month (Caramel Cloud Latte as the example).
- **Demo helper** in the dashboard settings: "Simulate incoming orders" (a few at a time, mixed card/cash/pre-order) so the live queue can be shown in the pitch without a second device.
- Price math in integer fils, validated server-side. Never trust client prices. Validate all input. Basic rate limiting.
- Accessibility: keyboard navigable, visible focus rings, labelled controls, AA contrast in both themes, status never conveyed by colour alone.
- Empty, loading and error states designed for every screen. No console errors. No dead buttons: anything not built must not appear in the UI.
- Add a few tests for the queue ordering, ETA calculation, cash-payment gating and loyalty maths.

## 8. Build order (cut from the bottom if time runs short)

1. Design tokens, theme toggle, layout shells (customer and dashboard), auth, database, menu seed.
2. Menu, cart, checkout (card mock and cash), order creation, realtime tracking, queue and dashboard order actions, ETA.
3. Home page with loyalty, Drink of the Month, Popular Picks; dashboard menu manager and promotions.
4. Pre-order time slots with correct queue placement.
5. "What are you in the mood for?", "Create your own coffee".
6. Events hub with moderation.
7. Statistics tab with charts and the seeded history.
8. Push and browser notifications, QR code, ratings, Summit Box, customers tab, demo simulator.
9. Polish pass: spacing, copy, imagery, motion, accessibility, cross-device check.

When you are done, give me: the run steps, the seeded login credentials, the environment variables I must fill in (especially `GOOGLE_CLIENT_ID` and the authorised JavaScript origins to add in Google Cloud Console), and a short list of anything that is mocked.
