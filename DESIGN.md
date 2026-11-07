---
version: alpha
name: Altitude
description: Warm, calm specialty-coffee interface. Charcoal and amber by default, sand and navy in light mode. Condensed display type over a clean humanist sans.
colors:
  dark-background: "#141210"
  dark-surface: "#1D1A17"
  dark-raised: "#27221E"
  dark-line: "#3A342E"
  dark-text: "#F1E9DC"
  dark-text-muted: "#B5A998"
  dark-accent: "#E8B26A"
  dark-accent-text: "#1A1208"
  light-background: "#EFE7DA"
  light-surface: "#F8F3EA"
  light-raised: "#FFFFFF"
  light-line: "#D8CCB8"
  light-text: "#1B1814"
  light-text-muted: "#5E5548"
  light-primary: "#082855"
  light-primary-text: "#F8F3EA"
  oak: "#C69A63"
  navy: "#082855"
  success-dark: "#8CC495"
  success-light: "#2F6B3A"
  warning-dark: "#E8B26A"
  warning-light: "#8A5A0B"
  danger-dark: "#EE8A7A"
  danger-light: "#A33A2B"
typography:
  display-xl:
    fontFamily: Barlow Condensed
    fontSize: 56px
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: 0.01em
  display-lg:
    fontFamily: Barlow Condensed
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: 0.01em
  headline:
    fontFamily: Barlow Condensed
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: 0.02em
  title:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.08em
  price:
    fontFamily: Barlow Condensed
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.0
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
components:
  button-primary:
    backgroundColor: "{colors.dark-accent}"
    textColor: "{colors.dark-accent-text}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: 14px 20px
  button-primary-light:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-primary-text}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: 14px 20px
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.dark-text}"
    rounded: "{rounded.md}"
    padding: 14px 20px
  card-menu-item:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.lg}"
    padding: 0px
  input:
    backgroundColor: "{colors.dark-raised}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.md}"
    padding: 12px 14px
  badge-tier:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.dark-text}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 4px 8px
---

<!-- SEED -->
<!-- This is a pre-implementation seed. Values above are the starting direction, not a captured system. Run /impeccable document again once there is code, so this file reflects the real tokens and components. -->

# Design System: Altitude

## Overview

**Creative north star: "the room at golden hour."** The interface should feel like Altitude itself: a warm, softly lit study cafe with pale oak, sand plaster, matte black fixtures and long glowing light bands. It is calm, tactile and a little premium, not techy.

Dark mode is the default and is the hero presentation: warm charcoal surfaces lit by one amber accent, like the cafe's LED strips against dark fittings. Light mode is the daytime version: sand and cream with navy as the primary action color, taken from the Altitude logo and menu.

Two tempos share one identity. The customer app is inviting, photography-led and slightly editorial. The dashboard is faster and denser, with larger touch targets, clearer status, and less ornament.

Personality: warm, calm, quietly confident. Mountain-climbing vocabulary used sparingly.

Reference material: the cafe photos (sand walls, oak dimple panels, curved black and glowing light bands, backlit lettering), the official Altitude logo (arched navy wordmark above a bicycle chain-link mark), the menu's layered mountain artwork, and the condensed heading style on the menu.

**Key characteristics**
- Warm neutrals, never cold grey, never pure black or pure white
- One accent at a time: amber in dark mode, navy in light mode
- Big condensed headings, quiet body text
- Real photography; consistent fallback panels when a photo is missing
- Restraint: few shadows, few colors, few effects

## Colors

**Dark mode (default)**
- **Background** `dark-background` (#141210): warm charcoal page base.
- **Surface** `dark-surface` (#1D1A17): cards and panels.
- **Raised** `dark-raised` (#27221E): inputs, sheets, hovered cards.
- **Line** `dark-line` (#3A342E): hairline dividers and borders.
- **Text** `dark-text` (#F1E9DC): warm off-white.
- **Muted text** `dark-text-muted` (#B5A998): secondary text, still passes AA on background and surface.
- **Accent** `dark-accent` (#E8B26A): the LED glow. Primary buttons, active states, progress fill, key numbers.

**Light mode**
- **Background** `light-background` (#EFE7DA) sand; **Surface** `light-surface` (#F8F3EA) cream; **Raised** `light-raised` (#FFFFFF) for inputs and sheets only.
- **Primary** `light-primary` (#082855): navy for primary buttons, links and the tier badge.
- **Text** `light-text` (#1B1814); **Muted** `light-text-muted` (#5E5548); **Line** `light-line` (#D8CCB8).

**Shared**
- **Oak** `oak` (#C69A63): decorative only (patterns, illustration tints, thin accents). Never used for text on light backgrounds because contrast is too low.
- **Navy** `navy` (#082855): sampled from the official logo. Used for the logo on light backgrounds, tier badges, and large brand panels in either theme.

**Status colors** (always paired with a text label or icon, never color alone): success, warning, danger, each with a dark-mode and light-mode value.

**Named rules**
- **One accent rule.** Only one accent color is active on a screen. Amber in dark mode, navy in light mode. Do not mix them.
- **No pure black or white.** Backgrounds and text always carry the warm tint.
- **Accent is rare.** It marks the one thing to do next or the one thing in progress. If everything glows, nothing does.
- **Contrast first.** Every text and background pairing must meet WCAG AA in both themes. Verify, do not assume.

## Typography

- **Display and headings: Barlow Condensed** (700 for display, 600 for headlines). It echoes the condensed lettering of the logo and menu headers. Use for page titles, section heads, item names on large cards, and prices. Uppercase is allowed for short labels and the wordmark, not for sentences.
- **Body and UI: DM Sans** (400 and 600). Clean, humanist, comfortable at small sizes.
- Self-host both fonts. Do not use Inter, Roboto, Poppins or system default stacks.
- **Scale**: display-xl 56, display-lg 40, headline 28, title 18, body 16, body-sm 14, label 12 (uppercase, tracked), price 22. On phones, scale display sizes down about 25 percent.
- **Prices** use the condensed face with tabular figures, always with "AED" as a small label beside the number, never a symbol.
- **Named rules**
  - **Big and quiet.** Contrast in size comes from the headline against calm body copy, not from many weights and colors.
  - **Sentence case for sentences.** Title case or uppercase only for short labels and the wordmark.
  - **No gradient text.**

## Layout

- **Base unit** 8px. Spacing scale: 4, 8, 16, 24, 40, 64.
- **Customer app, phone**: single column, bottom tab bar (Home, Menu, Orders, Events, Profile), content inset 16px, safe-area aware. Thumb-reachable primary actions at the bottom.
- **Customer app, tablet and laptop**: side rail or slim top nav; menu and cart sit side by side; content max-width about 1200px, centered.
- **Dashboard**: tablet-first. Left navigation rail that collapses to a bottom bar or drawer on small screens. The queue screen is lane-based with large cards; a kitchen display mode increases type and hides chrome.
- **Rhythm**: vary the layout. Mix a full-bleed photo hero, an asymmetric two-column block and a dense list rather than repeating identical card grids. Generous vertical space between sections (40 to 64px), tight spacing inside a card (8 to 16px).
- **Breakpoints to design and test**: 375, 768, 1024, 1440.
- **Touch targets** at least 44px. Dashboard primary actions at least 56px tall.
- **Named rule: no card soup.** Do not wrap every group of content in a card. Use whitespace, dividers and type hierarchy first; use a card only when the content is an independent object (a menu item, an order, an event).

## Elevation & Depth

- Depth comes mainly from **tone**, not shadow: background, surface, raised. Hairline `line` borders separate surfaces.
- Shadows are rare and soft, used only for sheets, menus and the sticky order tracker, and are warm-tinted, never grey or blue.
- **Warm glow** is the signature effect: a thin amber edge light on the active element, such as the progress track, the focused input or the live order card. It is subtle (a 1px line plus a faint soft halo), echoing the cafe's light bands. It is never used as decoration on idle elements.
- Backgrounds may carry very low-contrast texture: fine paper grain, and the round-dimple pattern from the oak panels. Texture must stay subtle enough to not affect legibility.
- No glassmorphism, no heavy blur, no neon.

## Shapes

- **Corner radii**: 4px (badges, chips), 8px (buttons, inputs), 12px (cards, sheets). Pills (`full`) only for small status chips and the toggle switch.
- **The chain-link mark** from the official logo is the brand shape. It appears only as the supplied logo files, never redrawn. Tier badges and avatar frames use a plain rounded-square or circle outline, not a made-up shield.
- **The curved light band**: a long smooth curve used as the order progress track, the section dividers and the loading line.
- **Mountain layers**: stacked low-contrast silhouettes in oak and navy tints for empty states, the loyalty progress visual and tier artwork.
- **Icons**: one line icon set (Lucide or Phosphor), one stroke weight, 20 to 24px. Used only for function: navigation, actions, status. Never decorative, never inside a colored circle above a heading. No emojis, ever.
- **Imagery**: photography is full-bleed or rounded at 12px. Missing photos use a consistent tone-on-tone duotone panel with the item name set in the display face.

## Components

**Buttons.** Primary: accent fill in dark mode, navy fill in light mode, 8px radius, 14px by 20px padding, title text, one per screen section. Secondary: outlined with `line` border and text color. Tertiary: text only with underline on hover. Disabled state is clearly different and explains itself where it matters (for example "Pick a time to continue"). Focus ring: 2px accent outline with 2px offset, always visible.

**Menu item card.** Image on top (4:3), item name in headline, a short descriptor in body-sm muted, price in the price style at the bottom left, an add control at the bottom right. Sold-out items stay visible with a "Sold out" label and no add control.

**Item sheet.** A bottom sheet on phone, a side panel on larger screens: temperature, milk, extras and a note to the barista, with a running price and one primary "Add to order" button.

**Inputs.** Raised surface fill, 8px radius, a visible label above, helper text below, focus shows the warm glow edge. The mood box is one large multi-line input with a rotating placeholder example, and no chat styling.

**Loyalty card.** A tier badge (text label on a navy chip), points in the display face, a mountain-layer progress visual to the next tier, and one line of text ("260 pts to Platinum"). It is the only place a large amount of artwork appears in a card.

**Order tracker.** Four steps (Placed, Payment, Preparing, Ready) along a curved glowing track. The current step glows in the accent, completed steps are solid, future steps are outlined. Under it, the plain-language status and time estimate ("Two ahead of you. About 6 minutes."). When waiting for cash payment, the track stops at step 2 and the text reads "Pay at the counter to start your order." A compact version appears as a sticky mini tracker while an order is active.

**Payment success.** A single drawn checkmark animation on a solid circle in the accent, under 700ms, then the order screen. No confetti.

**Time-slot picker.** A horizontally scrolling row of time chips; full slots are disabled with a "Full" label.

**Mood results.** Three picks as large photo cards with the drink name, price, one short line of reasoning, and an add button. No avatar, no chat bubbles, no sparkle icon.

**Builder.** Step list on one side, a live cup illustration on the other (stacked on phones), live price updating as choices change.

**Event card.** Cover image, club name as a label, title in headline, date and place in body-sm, an "I'm interested" action. Pending posts show a neutral "Pending review" chip.

**Dashboard order card.** Large order number in the display face, customer first name, items with modifiers, pickup or due time, a payment status chip, elapsed time. One obvious primary action per state: Accept payment, Start, Mark ready, Mark collected. Late orders get a clear text label as well as a color change.

**Charts.** Themed to the tokens: accent for the primary series, muted lines for the rest, no gradients or 3D, direct labels instead of legends where possible, with the most important number stated in text above each chart.

**Toasts and dialogs.** Quiet, bottom placed, short human copy, no icons beyond status.

**Logo.** Always use the supplied official files in `public/brand/` and never recreate the wordmark in a font. Cream version on dark backgrounds, navy version on light. Full logo for the splash screen, login screens and order confirmation; the chain-link mark alone for the app header on phones, the dashboard sidebar, favicon and PWA icon. Minimum height 28px for the mark. Keep clear space around it equal to the mark's centre hole, and put it on a solid panel, never directly over a photo. Do not add shadows, outlines, gradients or animation effects to it.

## Do's and Don'ts

**Do**
- Keep dark mode as the default and light mode a first-class equal. Remember the choice and follow the system preference on first visit.
- Use the amber accent (dark) or navy (light) for the single most important thing on a screen.
- Let photography and large condensed type do the heavy lifting.
- Write short, specific, human copy that states time and price plainly.
- Use motion for meaning: the tracker filling, the checkmark drawing, a sheet sliding. Keep durations short and respect reduced motion.
- Show designed empty, loading, error and offline states on every screen.
- Check contrast for every text and background pair in both themes.
- Design for the tablet at the counter as seriously as the phone in the student's hand.

**Don't**
- No emojis, anywhere, including copy, toasts and seed data.
- No purple or blue-violet gradients, no gradient text, no glassmorphism, no neon glows, no floating blobs.
- No sparkle or magic-wand icons, no "AI-powered" labels, no chatbot styling on the mood feature.
- No grid of three identical icon-title-paragraph cards. No icons in colored circles above headings.
- No pure black backgrounds or pure white surfaces.
- No Inter, Roboto, Poppins or default system font stacks.
- No decorative shadows on every card, no heavy rounded pill shapes everywhere.
- No dark patterns: no fake urgency, no countdown pressure, no confetti on routine actions.
- No color-only status. Always add text or an icon.
- Do not use oak as text color on light backgrounds.
- Do not show anything in the UI that is not built. No dead buttons.
