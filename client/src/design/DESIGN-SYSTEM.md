# Chai Time — UI & UX Design System

This is the reference for how the **client** (`client/src/`) looks, moves and is
put together. Hand it to Claude before asking for visual or interaction changes
so the request lands in the right file and stays consistent with the rest.

> **App in one line:** a private, real-time social app for a small group — a
> phone-shaped column, warm and soft, that reads like Instagram-close-friends
> crossed with a group chat. Every screen is live (SpacetimeDB subscriptions,
> never polling).

---

## 1. Non-negotiables — rules that run through everything

These are load-bearing. Break one and the app stops feeling like itself.

1. **Phone-first, always a column.** Max width `--app-max` (460px). On desktop it
   becomes a centred phone-width card on a darker ground — never a dashboard,
   never full-bleed.
2. **No hardcoded values.** Every colour, shadow, radius, duration, blur and
   space step is a token in `tokens.css`. If a value is used twice it becomes a
   token. Components read `var(--…)`, never literals. (A few one-off feature
   accents — roast orange, titles violet — are the deliberate exception and are
   commented as such.)
3. **Warm, never clinical.** Background is ivory `#faf8f5`, never pure white.
   Text is near-black warm `#16141a`, never `#000`. Greys are warm
   (`--text-secondary` has a violet cast).
4. **Motion is fast, springy, small.** Nothing exceeds ~380ms. Anything a finger
   touches answers in <150ms. Springs, not linear easing, for anything physical.
5. **Every tactile surface responds.** `whileTap={{ scale: 0.97 }}` + a haptic.
   Buttons, chips, cards, nav items, reaction pills — all of them.
6. **Loading = skeleton, never blank.** A shimmering placeholder that matches the
   real layout. No spinners-on-white, no empty screens, no layout shift when data
   arrives.
7. **Live by default.** Data comes from `useTable(...)` subscriptions. A change on
   someone else's phone is already a re-render on yours. No refetching, no "pull
   to refresh".
8. **A room changes its accent, gradient and chip colour — never its layout.**
   Six rooms in a list still read as one system.
9. **Fallbacks are warm, not grey.** Failed avatar → pastel monogram, never a
   silhouette. Missing cover → mood gradient.

---

## 2. Design tokens (`src/design/tokens.css`)

All tokens live on `:root`. `motion.ts` mirrors the motion ones for Framer
Motion (JS can't read CSS custom properties for spring configs).

### Colour

| Group | Tokens | Use |
|---|---|---|
| Surfaces | `--bg` `--bg-sink` `--bg-veil` `--surface` `--surface-raised` `--surface-glass(-strong)` `--scrim` | `--bg` = app ground; `--bg-sink` = input wells / recessed; `--surface` = cards; `--scrim` = behind overlays |
| Ink / text | `--ink` `--ink-muted` `--text-primary` `--text-secondary` `--text-tertiary` `--text-on-dark` | secondary = warm grey for sub-text; tertiary = faint/meta |
| Hairlines | `--hairline` `--hairline-strong` | card borders, dividers (never a solid grey line) |
| Accent | `--accent` (`#6c5ce7` indigo) `--accent-deep` `--accent-soft` `--accent-tint` `--accent-ink` | `--accent-soft` bg + `--accent-ink` text is the standard "tinted" pairing |
| Pastels | `--pastel-{lavender,blue,peach,yellow,mint,pink,sand}` + matching `--ink-{…}` | room moods, chips, illustration. Always pair a pastel bg with its `--ink-*` |
| Status | `--success(-soft)` `--warning(-soft)` `--error(-soft)` `--live` (`#f0526a`) | `--live` is the "happening now" red — live dots, event banners |
| Presence | `--presence-online` `--presence-away` `--presence-offline` | the dot on avatars |
| Gradients | `--grad-primary` `--grad-capture` `--grad-warm/cool/sun/leaf` `--grad-sheen` | `--grad-primary` = primary buttons; `--grad-sheen` = skeleton shimmer |

### Type (`--font-ui` = Plus Jakarta Sans, rounded fallbacks; `--font-hand` = Caveat)

Ramp — use the **class** (`.t-h2`) or the **token** (`font: var(--t-h2)`):

`--t-display` 34 · `--t-h1` 26 · `--t-h2` 20 · `--t-h3` 17 · `--t-body` 15/500 ·
`--t-body-strong` 15/600 · `--t-sm` 13.5 · `--t-xs` 12/600 · `--t-micro` 10.5/700
uppercase-tracked.

Helpers: `.muted` (secondary), `.faint` (tertiary), `.truncate`, `.clamp-2`,
`.t-hand` (handwritten accent — used sparingly, e.g. celebratory copy).
Tracking tokens: `--track-tight` for headings, `--track-wider` for `.t-micro`
labels.

### Space — 4px base

`--s-1`…`--s-16` (0.25rem … 4rem). `--gutter` (1.25rem) is the screen side
padding — use the `.gutter` class or `padding-inline: var(--gutter)`.
`--nav-space` = clearance so content clears the floating bottom nav.

### Radius

`--r-xs` 8 · `--r-sm` 12 · `--r-md` 16 · `--r-lg` 20 · `--r-xl` 26 · `--r-2xl` 32
· `--r-3xl` 40 · `--r-pill` 999. Cards are `--r-xl`; inputs `--r-lg`; buttons
`--r-pill`; small inner tiles `--r-sm`.

### Elevation, blur

`--shadow-xs`…`--shadow-xl` plus `--shadow-photo` (warm, for imagery),
`--shadow-accent` (violet glow, primary buttons), `--shadow-inset`.
Shadows are soft and long, low opacity. `--blur-sm/md/lg` for glass.

### Motion tokens

Durations `--d-instant` 90ms · `--d-fast` 150 · `--d-base` 230 · `--d-slow` 380 ·
`--d-slower` 560. Eases `--ease-out` (default), `--ease-in-out`, `--ease-spring`.

### Layout / z-index

`--app-max` 460px · `--nav-height` 68px · `--safe-top/-bottom` (notch insets).
Z-scale: `--z-content` 1 · `--z-sticky` 20 · `--z-nav` 40 · `--z-sheet` 60 ·
`--z-modal` 70 · `--z-toast` 90 · `--z-camera` 100. **Respect this order** —
don't invent z-index values.

### Room moods (`[data-mood='…']`)

`family` warm/peach · `friends` lavender/pink · `trip` cool/blue · `event`
sun/yellow · `college` leaf/mint · `other` sand. Setting `data-mood` on a
container swaps `--mood-grad`, `--mood-soft`, `--mood-ink` for everything inside.
The `RoomHeader`, room cards and mood chips all key off this.

---

## 3. Motion system (`src/design/motion.ts`)

**Springs** (`spring.*`) — pick by what's moving:

| Name | Feel | For |
|---|---|---|
| `snappy` | barely any overshoot | buttons, chips, presence dots, `pressable` |
| `gentle` | soft settle | cards & list items entering |
| `bouncy` | a little physical bounce | sheets, modals, camera, full-screen surfaces |
| `pop` | overshoots, playful | reaction pops, badge unlocks, celebratory bits |

**Variants** (Framer `variants` presets):

- `pageVariants` — top-level screen swap: soft fade + tiny vertical travel
- `pushVariants` — drill-down / room switch: horizontal slide
- `riseVariants` — full-screen surfaces from the bottom (camera, preview)
- `listVariants` + `itemVariants` — staggered feed/list entrance
  (`staggerChildren: 0.055`)

**Interaction presets** (spread onto a `motion.*`):

- `pressable` — `whileTap: scale 0.97` + `snappy`. The default for everything
  tappable.
- `pressableCard` — `scale 0.985` (a card shouldn't shrink as much)
- `shutterPress` — `scale 0.88` + `pop` (camera shutter)

**Pair every press with a haptic** (`src/lib/haptics.ts` — `haptic('light' |
'medium' | 'heavy' | 'success')`): `light` for nav/toggles/chips, `medium` for
primary actions & capture, `success` after a send completes.

**Reduced motion** — `base.css` kills animations under
`prefers-reduced-motion: reduce`. Don't rely on an animation to *convey* state;
it's always decoration over a correct static layout.

**Shared-element transitions** use `layoutId`: `"nav-blob"` (the active-tab
blob), `"segmented-pill"` (the tab-switcher pill). Reuse this pattern for any
"one indicator slides between positions" need.

---

## 4. Layout & shell

```
<body>  (darker ground on desktop only)
 └─ .app-frame            ← the phone column, max-width --app-max, clips overflow
     ├─ ConnectionBanner  ← slides down when the socket drops
     ├─ BadgeUnlockHost   ← full-screen celebration, portal
     ├─ ScreenSwap        ← AnimatePresence mode="popLayout", keyed by routeKey
     │   └─ <Screen>       ← the current screen
     └─ TabBar            ← floating bottom nav (only on top-level screens)
```

- **`.screen`** — every screen root: `min-height: 100dvh`, column flex,
  `padding-bottom: var(--nav-space)`. Use `.screen--flush` when the screen owns
  its own bottom edge (room composer, camera).
- **`.gutter`** — horizontal screen padding. **`.section-head`** — the
  `Title ····· meta` row above a list (baseline-aligned, gutter-padded).
- **`.rail`** — full-bleed horizontal scroller with gutter-aligned ends and
  hidden scrollbar (people rail, sticker tray, activity presets).
- **`ScreenSwap`** uses `mode="popLayout"` deliberately — `mode="wait"` caused
  white screens when navigation was triggered from inside the exiting subtree.
  **Do not change this back.**

---

## 5. Navigation & routing (`src/lib/router.tsx`)

A ~100-line hand-rolled router — no routing library. Real URLs (so invite links
work), a back stack, and a `direction` hint for transitions.

**Three top-level destinations**, one of which is a verb:

- **Rooms** (`/`) — home
- **Capture** — the floating shutter proud of the bar; the thing the app exists
  to do
- **Me** (`/me`) — profile

The bottom nav (`.nav`) is glass, floats above content, and only shows on
top-level screens (`tabFor()` returns `null` elsewhere). Inside a room the
**composer** owns the bottom edge and the **header back button** is the way out —
the bar is hidden.

**URL scheme:** `/` · `/r/CODE` · `/r/CODE/members` · `/r/CODE/invite` ·
`/join/CODE` · `/create` · `/camera/CODE?` · `/me` · `/settings` · `/welcome`.

**Transition direction** is derived from a per-route `DEPTH` map: same depth →
`none` (fade), deeper → `forward` (slide left), shallower → `back` (slide right).
`back()` is debounced ~350ms and tracks `appDepth` so hammering it can never walk
the browser out of the app — it falls back to `parentOf(route)`.

`go(route, { replace })`, `back()`, and the current `route`/`direction` come from
`useRouter()`.

---

## 6. Screen anatomy

### Headers (`src/components/TopBar.tsx`)

- **`<TopBar>`** — the plain one: back arrow, title + optional subtitle, 1–2
  action `icon-btn`s. Used by Members, Invite, Settings, Profile, Create.
- **`<RoomHeader>`** — the room's own: carries `data-mood`, condenses on scroll
  (`useScroll` on the room's scroll container drives a glass wash in and a slight
  title scale-down), and the **`<Segmented>`** tab switcher rides underneath.
- **`<Segmented>`** — Live / Moments / Chat style switcher; the active pill is a
  `layoutId="segmented-pill"` that slides. Options can carry a `count` badge.

### The room screen (`src/screens/Room.tsx`)

`RoomHeader` (fixed) + `.room-scroll` (the scroll container, `data-composer`
toggles bottom padding for the composer) + `Composer` (fixed bottom, members
only). Inside the scroll, in order: peek-in / join strip → Replay CTA → live
Prompt card → the active tab's content (`AnimatePresence mode="wait"` between
tabs).

---

## 7. Component primitives (`src/design/base.css`)

### Buttons — `.btn` + a variant

Base: pill, `min-height: 52px`, `--t-body-strong`. Variants:

| Class | Look | Use |
|---|---|---|
| `.btn--primary` | `--grad-primary` fill, violet glow | the one main action per screen |
| `.btn--ink` | near-black fill | high-contrast secondary (e.g. on imagery) |
| `.btn--soft` | white, hairline border, `--shadow-sm` | secondary |
| `.btn--tinted` | `--accent-soft` bg / `--accent-ink` text | low-emphasis affirmative |
| `.btn--ghost` | transparent, secondary text, shorter | tertiary / dismissive |
| `.btn--sm` | 40px, `--t-sm` | inline / in-card |
| `.btn--block` | full width | — |

`.icon-btn` — 42px circular (top bars, sheet dismiss). `.icon-btn--glass` for
over-imagery (camera, photo viewer). `.icon-btn--bare` for no chrome.

### Pills & chips — `.pill`

26px pill, `--bg-sink`. Variants: `.pill--live` (red, "happening now"),
`.pill--online`, `.pill--accent`, `.pill--glass` (over imagery), `.pill--mood`
(uses the room's `--mood-soft`/`--mood-ink`). `.dot-live` is the pulsing dot.

### Surfaces

`.card` (`--surface`, `--r-xl`, `--shadow-sm`, hairline border) · `.card--raised`
(`--shadow-md`) · `.glass` (`--surface-glass` + backdrop blur + saturate — nav,
sheets, over-imagery chrome).

### Fields

`.field` (label + control stack) · `.field__label` (`--t-xs`, secondary) ·
`.input` (54px, `--r-lg`, 1.5px hairline; focus = accent border + 4px
`--accent-tint` ring) · `.input--flush` (sits in a `--bg-sink` well, no border) ·
`textarea.input` (min 96px, no resize).

`.opt-row` — the selectable row (create-room type picker, settings toggles):
glyph tile + label + check. `[data-selected='true']` tints with the mood/accent.

### Skeletons

`.skeleton` — `--bg-sink` block with a `--grad-sheen` shimmer sweep.
`.app-skeleton` is the whole-app loading state and **mirrors the static boot
skeleton in `client/index.html`** exactly, so React taking over is invisible.
When you add a screen, give it a matching skeleton.

### Avatars (`src/components/Avatar.tsx`)

`<Avatar name src size presence badge ring />` — photo is the happy path; on
error it falls back to a **warm pastel monogram** picked by hashing the name.
`<PresenceDot>` crossfades colour (doesn't snap) when someone comes online;
online state gets a `.presence__halo` ping. `<AvatarStack>` for overlapped
groups with a `+N` overflow chip.

---

## 8. Overlays (`src/components/Overlay.tsx`)

- **`<BottomSheet>`** — springs up (`bouncy`), dims behind (`.overlay-scrim`),
  closes on backdrop tap / Escape / **downward drag** (`> 110px` or fast flick).
  Has a `.sheet__grip`. This is the default container for any "pick / configure /
  confirm" flow: activity picker, prompt settings, roast composer, room menu.
- **`<Modal>`** — centred, scale+fade in. For short confirmations / celebrations.
- **`<EmojiPopover>` / `<EmojiPicker>`** — real `emoji-picker-react`, rendered in
  a **portal** with fixed positioning anchored to its trigger (so it's never
  clipped by `overflow: hidden`). Used for status emoji, reactions, avatar.
- **`<Toast>`** (`useToast()`) — `toast({ message, tone?, emoji? })`. Transient,
  top, auto-dismiss. The standard way to surface a reducer error:
  `call(conn.reducers.x(...), (msg) => toast({ message: msg, tone: 'error' }))`.
- **`<BadgeUnlock>`** — full-screen celebration (medallion + particles), tap or
  4.2s to dismiss. Triggered by `useMyBadges()` seeing a new badge.

---

## 9. Feature surfaces & their patterns

| Surface | Where | Pattern |
|---|---|---|
| **Live tab** | `LiveTab.tsx` | voice CTA → your status card → **Today's Titles** card → presence grid → invite. "Who's here and what are they doing." |
| **Moments feed** | `MomentCard.tsx` | full-bleed media card, caption, `ReactionBar` (emoji pills + reply), roast pill when roast mode is on. Staggered entrance. |
| **Chat** | `ChatTab.tsx` | message runs collapse when same author within 2 min; a message carrying a `momentId` renders as a reply-to-moment. |
| **Composer** | `Composer.tsx` | text + emoji + photo/video + **hold-to-record voice** (gesture tracked on `window`, slide left to cancel). |
| **Camera → Preview** | `Camera.tsx` → `PostPreview.tsx` | full-screen `riseVariants`. Capture → caption + stickers + pick a room → post. Video poster frame is grabbed at capture time. |
| **Replay the Room** | `ReplayRoom.tsx` | a cinematic catch-up of what you missed — timed "beats", a "room collision" montage. Full-screen overlay. |
| **Roast mode** | `RoastSheet` / `RoastReactionSheet` / `RoastLeaderboard` | per-room toggle; tap-to-roast a moment with a heat level (mild/spicy/savage); leaderboard is a ranked mini-feed (thumbnail + text + sender + bold vote count). Accent = orange/red, its own commented section in `room.css`. |
| **Scheduled prompts** | `PromptSettingsSheet.tsx` / `PromptCard.tsx` | owner queues up to **7** daily times (real `<input type="time">`, one row per slot with time + source + delete); a fired prompt shows as a card at the top of the room. |
| **Today's Titles** | `TodaysTitles.tsx` | daily superlatives card on the Live tab; one row = emoji badge + avatar + "Title · Name" + one-line descriptor. Recomputed live by the module's sweep. Accent = violet/pink, its own commented section. |
| **Streaks & badges** | `StreakFlame.tsx` / `BadgeUnlock.tsx` | a flame with a day count next to a name; badges award once and celebrate full-screen. |

---

## 10. Data & UX pattern (what "live" means in practice)

- **Reads:** `useTable(tables.X)` inside a hook. Two app-level `.subscribe([...])`
  calls in `App.tsx` (a `core` set and a `features` set) prime everything;
  screens never subscribe themselves.
- **Assembly hooks** (`src/data/`): `useRoom(code)` assembles one room fully
  (members, moments+media+reactions+replies, messages, gallery, events, titles,
  voice) as derived `MomentView`/`MessageView` objects. `useRooms()` does the
  rooms list. These memoise hard so a reaction landing doesn't restart card
  entrance animations.
- **Writes:** `call(conn.reducers.doThing(args), onError)` from `src/data/db.ts`.
  Reducers return nothing; the UI updates because the subscribed table changed.
- **Clock-based state** (typing, "speaking now") is derived *outside* the main
  memo against `useNow(ms)` so it doesn't churn object identity every second.
- **Optimism:** generally not needed — the round-trip is fast enough that the
  subscription update *is* the feedback. Add a local pending state only for
  slow things (media upload).
- **Loading:** a hook returns `[rows, ready]`. While `!ready`, render the
  screen's skeleton, not a partial UI.

---

## 11. File map — where to make a change

| You want to change… | Edit |
|---|---|
| A colour, font size, spacing step, shadow, radius, duration | `src/design/tokens.css` |
| A spring / variant / press feel | `src/design/motion.ts` |
| A button/pill/card/input/skeleton primitive | `src/design/base.css` |
| A specific screen or feature's look | `src/design/components.css` (shell, home, moments, nav, overlays, camera, profile…) or `src/design/room.css` (everything inside a room + roast + prompts + titles + replay) |
| A component's markup / behaviour | `src/components/<Name>.tsx` |
| A whole screen's composition | `src/screens/<Name>.tsx` |
| Navigation, URLs, back behaviour | `src/lib/router.tsx` |
| What data a screen gets | `src/data/use*.ts` |
| Room mood palettes | bottom of `src/design/tokens.css` |

CSS is **plain CSS with BEM-ish class names** (`.room-card__media`,
`.reaction--add`) — no CSS modules, no Tailwind, no styled-components. Sections
are separated by banner comments; add yours in the matching file.

---

## 12. How to ask for changes (so they stay consistent)

- **Name the token, not the pixel.** "Make section headers `--t-h2`" beats "make
  the headers 20px".
- **Say which surface.** "On the Moments feed card…" / "In the room header…".
- **New accent colour for a feature?** Follow the roast/titles precedent: a
  small, commented set of literals in a dedicated `room.css` section, not new
  global tokens.
- **New tappable thing** → it gets `pressable` + a haptic + a focus style
  automatically if you use the existing button/pill classes.
- **New screen** → add a route in `router.tsx` (with a `DEPTH`), a case in
  `App.tsx`'s `ScreenBody`, a `.screen` root, and a matching skeleton.
- **New overlay** → use `<BottomSheet>` or `<Modal>`, don't hand-roll one.
- **New list/feed** → `listVariants` container + `itemVariants` children; read
  from a `use*` hook; skeleton while `!ready`.
- **Keep:** `ScreenSwap` on `mode="popLayout"`, the z-index scale, warm-not-grey
  fallbacks, "skeleton not blank", the 460px column.
