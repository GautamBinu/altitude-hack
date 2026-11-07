# Product

<!-- impeccable:product-schema 1 -->

## Product purpose

Altitude is a specialty coffee shop on the RIT Dubai campus. This product is its ordering and community web app: students order ahead, track their order, earn loyalty rewards and find out what is happening on campus, while staff run the counter from a dashboard.

It is built for the ideaForge hackathon (AIRC x Altitude, kickoff deck brief: "Build the app that fuels Altitude") and should be credible as something Altitude could actually roll out. The pitch is 3 minutes plus 2 minutes of questions, so the product must demo clearly and quickly.

The brief names six problems the product must solve:

1. Loyalty rewards: points and tiers that reward students on every order.
2. Order and queue: take-away or table orders, live queue position, a ready alert.
3. Popular picks: best-selling drinks and food, driven by order history.
4. Promo spotlight: marketing features the drink of the month and promotions.
5. Club and event hub: a space for RIT clubs and communities to share events and collabs.
6. Online payments, designed to integrate with Altitude's POS system, MOBIPOS.

On top of the brief, the product adds: a free-text "What are you in the mood for?" drink suggester, a "Create your own coffee" builder, pre-orders for a chosen pickup time, and a store dashboard with a kitchen queue, menu and price control, content moderation and business statistics.

## Platform

web

A responsive web app installable as a PWA. Works on phones, tablets and laptops. Two surfaces share one codebase: the customer app and the store dashboard.

## Stack

Set by the build brief (`SPEC.md`, section 2):

- Frontend: React, TypeScript and Vite; Tailwind with fully custom design tokens; React Router; installable PWA with manifest, service worker and offline app shell.
- Backend: Node and Express in TypeScript, with SQLite. One server serves the API, the built frontend and realtime updates over Server-Sent Events.
- Auth: Google Identity Services for customers, with the ID token verified on the server and a labelled "Continue as demo student" option when `DEMO_MODE=true`. Username and password for the dashboard, with hashed passwords and an httpOnly session cookie.
- Mood suggester: an LLM interprets the text when an API key is set; a local tag scorer is the fallback, so it always works offline.
- Deploy: one service on Render, Railway or Fly. Runs locally with `npm install && npm run dev`.

## Users

**Students and staff of RIT Dubai (customers).** Mostly 18 to 25, on their phones between classes, often in a hurry, often on campus Wi-Fi. They order a drink they already know, or want help choosing. Many sit and study at Altitude for hours, so they also care about the table experience and the events board. Some are club members who want to promote an event.

- Job to be done: get a drink and food fast without queuing, know exactly when it will be ready, and feel rewarded for coming back.
- Situation: one hand holding a phone, class starting in 15 minutes, uncertain how long the line is.
- Browse mode: relaxed, scrolling the menu or events while waiting.

**Baristas and counter staff (dashboard).** Working a busy counter on a tablet or laptop, hands wet or full, glancing at the screen between tasks. They need to see what to make next, in what order, and what is waiting on payment, without reading anything carefully.

- Job to be done: accept orders, make drinks in the right order, hand them over, keep the line moving.
- Situation: peak rush between classes, noise, interruptions, large touch targets needed.

**Altitude management and marketing (dashboard).** Run the shop day to day. They set prices and names, feature the drink of the month, approve or reject community posts, and read the numbers to decide what to stock and when to staff up.

- Job to be done: keep the menu and promotions current, protect the brand from bad posts, understand what sells and when.

## Positioning

The pitch makes three claims, in this order. Each is something a delivery app, a chain app or a white-label POS app could not say truthfully.

1. **Built around the campus day.** Ordering fits the gap between classes. A student can pre-order for when class ends, and the queue position and ETA come from Altitude's own queue, per-item prep times and the number of baristas on shift, so the app can answer "will I make it back in time". Loyalty rewards the daily habit.
2. **Altitude as the campus base camp.** The club and event hub and the community creations board make the cafe the place where RIT Dubai clubs and communities share what they are doing. Students already spend hours there with laptops; the app adds a community layer to that time, with ordering as the entry point.
3. **Run by the shop, ready for rollout.** Staff change every name, price, promotion and post from the dashboard without a developer. Payments go through a POS adapter shaped for MOBIPOS, so Altitude could adopt the app without a rebuild. In the prototype the adapter is a mock.

## Operating Context

**The hackathon.** ideaForge, run by AIRC x Altitude. Judging weights: Solution Fit 25%, Innovation and Creativity 20%, Technical Execution 20%, Design and Experience 20%, Pitch and Feasibility 15%. The prototype is due Sunday 8 November 2026 at 12 PM. The pitch is 3 minutes plus 2 minutes of questions.

**The demo.** Live, on two devices. A presenter orders on a phone; the dashboard runs on a laptop or tablet, likely projected, and reacts in real time. Staff actions on the dashboard move the tracker on the phone. This means:

- The phone to dashboard to phone loop must work end to end on separate devices, over whatever network the venue has.
- Dashboard screens must read from a distance on a projector. Phone screens must read when held up or mirrored.
- "Simulate incoming orders" in dashboard settings fills the queue so it looks busy without extra devices.
- `DEMO_MODE` lets the demo run without Google credentials.
- Whether judges also get a public URL to try is not decided.

**In the shop.** The counter holds the espresso machine, grinders, cup stacks and the payment terminal. The dashboard is planned for a tablet at that counter; whether Altitude already has one is not confirmed. Rushes come between classes. Many students sit at shared tables with laptops for long stretches. The shop already runs printed promotions at the counter (a "Special this week" card and a printed smoothie and milkshake menu); the promo spotlight is the digital version of that habit.

## Surfaces and how each should behave

- **Customer home**: welcoming and personal. Greets by name, shows loyalty standing, a live order if there is one, the drink of the month and what is popular on campus. Leads people into ordering rather than showing off.
- **Menu, builder and checkout**: task-focused. Speed, clarity of price, and no surprises.
- **Mood suggester**: a short, friendly exchange. One text box in, three confident picks out with a one-line reason each.
- **Order tracking**: calm and reassuring. The answer to "where is my order and how long" must be visible within a second.
- **Events hub**: browsable, community feel, editorial rather than transactional.
- **Dashboard queue**: operational, glanceable from an arm's length away, built for speed and error prevention.
- **Dashboard menu, promotions, moderation**: tidy, dense enough to be efficient, forgiving of mistakes.
- **Dashboard statistics**: readable at a glance, then explorable. Findings first, charts second.

## Brand personality

Warm, calm, quietly confident. A modern study cafe with a bit of mountain-climbing spirit (the name is Altitude; the menu has Summit Box, Death Eye, Red Eye). It feels like a place you want to stay for two hours with a laptop, not like a tech product.

Voice: short, specific, human, the way a good barista talks. Friendly without being bubbly. Direct about time and money. Uses the altitude vocabulary sparingly (summit, climb, base camp) and never as a gimmick. The wall of the shop reads "Elevate your experiences"; that line can appear once, in a fitting place, but should not be overused.

Examples of the voice:

- "Two ahead of you. About 6 minutes."
- "Pay at the counter to start your order."
- "Rainy day? Try these."
- Not: "Your order is being processed!" or "Unlock the power of coffee."

## Anti-references

- Generic "modern SaaS" or startup landing page patterns: gradient hero, three identical feature cards, abstract blobs.
- Anything that looks like it came from an AI design generator: purple or blue-violet gradients, gradient text, glassmorphism, neon glows, sparkle icons, decorative icon circles above headings.
- Emojis in any form: UI, copy, toasts, empty states, seed data.
- "AI-powered" labelling or chatbot styling on the mood suggester.
- Big-chain coffee app aggression: loud promotions, countdown pressure, dark patterns, confetti on every action.
- Gamified loyalty that feels childish (cartoon mascots, badge spam).
- Sterile enterprise admin templates for the dashboard.
- Corporate filler copy: "Welcome to the future of coffee", "seamless", "elevate your journey".

## Design principles

1. **Time is the main thing.** Every screen answers one of: what do I order, when will it be ready, what should I make next. Wait time and queue position are never hidden or vague.
2. **Warm, not flashy.** The mood is the cafe itself: calm, tactile, softly lit. Restraint beats decoration.
3. **Photography and typography carry the design.** Real drinks, big confident type, generous space. Icons only where they do a job.
4. **Two audiences, two tempos.** The customer app can be inviting and a little slower to browse. The dashboard is built for speed, big targets and glanceability. They share a brand, not a layout.
5. **Honest and human.** Prices, times and states are stated plainly. Copy reads like a person wrote it. Nothing is faked except where it is clearly a prototype (card payment, POS).
6. **Earned delight.** Small, quiet moments (a drawn checkmark, a progress track that fills like a climb) instead of constant animation.
7. **Control belongs to the shop.** Anything a customer sees (names, prices, promotions, events) is editable by staff without a developer.

## Product Principles

1. **Campus day first, community second, feasibility third.** When features compete for build time or screen space, the order-ahead loop (pre-order, queue, ETA, ready alert) wins, then the events and creations hub, then shop control and the POS story. The pitch follows the same order.
2. **The live loop never fails.** The demo depends on one moment: a phone order appears on the dashboard, and the phone's tracker moves when staff act. Anything that puts that loop at risk is cut or deferred.
3. **A working core over breadth.** Build in the priority order in `SPEC.md` and cut from the bottom. A feature that is not built does not appear in the UI.
4. **Real or clearly labelled.** Seed data, the card payment mock, the MOBIPOS adapter and placeholder prices are labelled as such in the dashboard, the README and the pitch. Nothing invented is presented as Altitude's own.

## Accessibility and constraints

- WCAG AA contrast minimum in both dark and light themes. Status is never conveyed by color alone.
- Fully keyboard navigable, visible focus states, labelled controls, respects reduced-motion settings.
- Touch targets at least 44px. Safe-area insets respected on phones. Dashboard designed tablet-first for a counter.
- Dark mode is the default presentation, with a light mode option that persists and follows system preference on first visit.
- Must work on slow campus Wi-Fi: lean assets, self-hosted fonts, designed loading and offline states.
- English first. Arabic and right-to-left support is a desirable later addition, so avoid layouts that make RTL hard.
- Card payment and MOBIPOS are mocked in the prototype. No real card data is collected or stored.
- Notifications cannot render a native progress bar in browsers, so order progress is conveyed through text in the notification and a full visual tracker inside the app.

## Terminology

- **Order**: one customer checkout, with a number that resets daily (for example "Order #27").
- **Queue**: the live, ordered list of paid orders waiting to be made. Pre-orders enter it at their due time.
- **Pre-order**: an order for a chosen pickup time rather than as soon as possible.
- **Pay at counter**: the cash option. The order stays at the payment step until staff accept payment.
- **Drink of the Month**: the featured promoted drink, set by marketing.
- **Popular on campus**: trending items computed from recent order history.
- **Summit Box**: Altitude's prepaid bundle of 6 or 10 drinks.
- **Tiers**: Bronze, Silver, Gold, Platinum.
- **Take-away / Dine-in**: the two fulfilment types. Dine-in captures a table number.
- **Creation**: a customer's own custom coffee from the builder.
- **Dashboard**: the staff-facing side, at `/dashboard`.

## Confirmed brand commitments

- **The official Altitude logo must be used wherever the brand appears** (header, login screens, splash and loading screen, order confirmation, notifications, PWA icon, dashboard sidebar, empty states). Never redraw, retype, recolour or restyle it. It is an arched navy ALTITUDE wordmark above a bicycle chain-link mark with a small peak inside. Supplied files belong in `public/brand/` (until the app is scaffolded they sit in `reference/brand/`): `altitude-logo-navy.png` and `altitude-logo-cream.png` (full logo, transparent) and `altitude-mark-navy.png` and `altitude-mark-cream.png` (chain-link mark only, for small sizes). Use the cream version on dark backgrounds and the navy version on light backgrounds. Keep clear space around it equal to the height of the chain-link's centre hole, and do not place it on busy photos without a solid panel behind it.
- The shop's tagline on its wall is "Elevate your experiences".
- The in-shop look is warm sand-colored walls, pale oak with a round-dimple pattern, matte black fixtures, long curved light bands with a warm glow, and mountain-layer artwork on the menu. The app should feel like it belongs in that room.
- No emojis anywhere in the product.

## Evidence on Hand

What exists:

- `SPEC.md`: the full build brief, including a summary of the kickoff deck. The deck itself is not in the repo.
- `reference/altitude_menu.txt`: the full menu, transcribed from photos. Prices look dated and are seed data the dashboard can edit. Smoothies, real milkshakes, food, snow ice and acai toppings have no price on the menu; they get placeholder prices flagged "unconfirmed" in the dashboard.
- Kickoff-deck examples: Caramel Cloud Latte (the example Drink of the Month), Cold Brew, Iced Latte and Croissant (the "Popular Now" examples). Caramel Cloud Latte and Cold Brew are not on the menu; Caramel Cloud Latte is seeded as the Drink of the Month with an unconfirmed placeholder price.
- `reference/cafe1.png` and `reference/cafe2.png`: two interior photos (WebP data despite the `.png` extension). They show the curved black light bands with a warm edge glow, the pale oak dimple panel with the backlit logo sign, the "Elevate your experiences" lettering, students working at shared tables, and the printed promotions at the counter. Customers appear with faces blurred. Whether the photos may be used inside the product is not confirmed, so treat them as reference only.
- `reference/brand/`: the four official logo PNGs (full logo and chain-link mark, in navy and cream). They are small rasters (the full logo is 491 by 516 px), so do not scale them up much; an SVG may replace them later. The sign in the shop frames the logo in a shield outline. The supplied files have no shield, and the files are the source of truth.

Not available, and not to be invented:

- Menu item photos. Every item uses the designed fallback until the team adds files at `public/images/menu/<slug>.jpg`.
- Real club names. Seeded clubs and events are samples and must not claim to be, or speak for, real RIT Dubai clubs.
- Opening hours and barista count. Seeded values are placeholders, editable in dashboard settings.
- Confirmed prices beyond the dated menu.
- Sales, traffic or order data from Altitude. The 30 days of order history are synthetic, and the pitch must not present seeded statistics as Altitude's real numbers.
- Testimonials, student quotes or survey results.
- MOBIPOS API access or documentation. The adapter interface is a best guess at the integration point.
- Real student data. Demo students use first names only.