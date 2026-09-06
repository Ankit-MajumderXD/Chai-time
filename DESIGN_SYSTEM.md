# Chai Time — Design System

A private, real-time space for your people. **Light, premium, realistic, fun, friendly, mobile-native.**

Every value below lives in `client/src/design/tokens.css`. Nothing in the app hardcodes a hex, a
shadow, a radius or a duration — if a value is worth using twice it is a token.

---

## 1. Principles

1. **People before product.** The first thing on screen is faces and what those faces are doing.
2. **Photography is the hero.** Chrome is quiet so pictures can be loud. Glass and gradient are
   seasoning, never the meal.
3. **Warm, never clinical.** The background is ivory (`#FAF8F5`), not white. Text is near-black
   (`#16141A`), not black. Nothing is pure.
4. **One system, six moods.** A room changes accent, cover, emoji and gradient — never layout.
5. **Fast beats fancy.** Touch feedback under 150ms; nothing longer than 380ms.
6. **Empty, loading and broken are designed states**, not afterthoughts.

---

## 2. Colour

### Surfaces
| Token | Value | Use |
|---|---|---|
| `--bg` | `#FAF8F5` | Page ground — warm ivory |
| `--bg-sink` | `#F3EFE9` | Recessed wells, input tracks, chips |
| `--surface` | `#FFFFFF` | Cards, sheets, rows |
| `--surface-glass` | `rgba(255,255,255,.74)` | Floating nav, condensed headers |
| `--scrim` | `rgba(20,17,24,.44)` | Behind sheets and modals |

### Ink
| Token | Value | Use |
|---|---|---|
| `--text-primary` | `#16141A` | Headings, primary text, dark buttons |
| `--text-secondary` | `#6C6774` | Supporting copy (warm gray) |
| `--text-tertiary` | `#9D98A5` | Timestamps, hints |
| `--hairline` | `rgba(22,20,26,.07)` | Borders, dividers |

### Accent
| Token | Value | Use |
|---|---|---|
| `--accent` | `#6C5CE7` | Soft indigo/violet — the one brand colour |
| `--accent-deep` | `#5847D4` | Gradient end, pressed states |
| `--accent-soft` | `#ECE8FF` | Selected chips, nav blob, tinted buttons |
| `--accent-ink` | `#3D3396` | Text on `--accent-soft` |

### Pastels (room moods, illustration, chips)
`--pastel-lavender #E8E2FF` · `--pastel-blue #D9E8FF` · `--pastel-peach #FFE2CF` ·
`--pastel-yellow #FFF0C6` · `--pastel-mint #D8F4E8` · `--pastel-pink #FFDCE8` ·
`--pastel-sand #F2E8DC`

Each has a matching readable ink (`--ink-lavender`, `--ink-blue`, …) so pastel surfaces never
need a colour guess.

### Status
| Token | Value |
|---|---|
| `--success` / `--success-soft` | `#35B981` / `#E2F7EE` |
| `--warning` / `--warning-soft` | `#E8A33D` / `#FFF1DC` |
| `--error` / `--error-soft` | `#E2606B` / `#FFE7E9` |
| `--live` | `#F0526A` |
| presence | `--presence-online #35B981` · `--presence-away #F0AD4B` · `--presence-offline #C8C3CD` |

### Gradients
Used **only** for: the primary CTA, the capture button, selected states, room mood washes.

- `--grad-primary` `linear-gradient(135deg,#8F7CF5,#6C5CE7 52%,#5B46D8)`
- `--grad-capture` — the camera button, slightly deeper
- `--grad-warm` / `--grad-cool` / `--grad-sun` / `--grad-leaf` — pastel mood washes

### Room moods
Set `data-mood="family|friends|trip|event|college|other"` on any subtree and three variables
change: `--mood-grad`, `--mood-soft`, `--mood-ink`. That is the entire theming mechanism.

| Mood | Emoji | Wash |
|---|---|---|
| Family | ❤️ | warm peach |
| Friends | ✨ | lavender → pink |
| Trip | 🏝️ | soft blue |
| Event | 🎉 | warm yellow |
| College | 🎓 | mint |
| Other | 🪄 | sand → lilac |

---

## 3. Typography

**Plus Jakarta Sans** for everything (modern, rounded, friendly, not cute), **Caveat** for the
handful of handwritten annotations on the onboarding collage.

| Token | Size / weight | Use |
|---|---|---|
| `--t-display` | 34px / 700 / 1.06 | "Real moments. Better together." |
| `--t-h1` | 26px / 700 | Screen titles, greetings |
| `--t-h2` | 20px / 700 | Room card titles, sheet titles |
| `--t-h3` | 17px / 700 | Section headers, top bar |
| `--t-body` | 15px / 500 | Body, captions |
| `--t-sm` | 13.5px / 500 | Supporting copy |
| `--t-xs` | 12px / 600 | Chips, labels |
| `--t-micro` | 10.5px / 700, uppercase, `+0.09em` | Stat labels, status |

Tracking: `--track-tight -0.021em` on display/h1/h2 only. Copy is **sentence case** throughout;
uppercase is reserved for micro labels.

---

## 4. Space, radius, elevation

**Space** — 4px base: `--s-1` 4 → `--s-16` 64. Screen gutter is `--gutter` (20px).

**Radius** — `--r-xs` 8 · `--r-sm` 12 · `--r-md` 16 · `--r-lg` 20 · `--r-xl` 26 · `--r-2xl` 32 ·
`--r-3xl` 40 · `--r-pill` 999. Major surfaces sit in the 16–32 range; every status marker is a pill.

**Elevation** — five steps, all warm-tinted (`rgba(22,20,26,…)`), never neutral gray:
`--shadow-xs` (hairline lift) → `--shadow-sm` (cards) → `--shadow-md` (room cards, sheets) →
`--shadow-lg` (nav, popovers) → `--shadow-xl` (modals). Plus two specials:
`--shadow-photo` (physical snapshots) and `--shadow-accent` (the violet glow under CTAs).

**Blur** — `--blur-sm` 8 · `--blur-md` 18 · `--blur-lg` 30. Glass is used in exactly four places:
the bottom nav, the condensed room header, toasts, and the post-preview sheet. Everything else is
opaque — this is *soft morphism*, not glassmorphism.

---

## 5. Motion

Durations `--d-instant` 90ms · `--d-fast` 150 · `--d-base` 230 · `--d-slow` 380.
Easing `--ease-out` `cubic-bezier(.22,1,.36,1)` · `--ease-spring` `cubic-bezier(.34,1.56,.64,1)`.

Springs (`client/src/design/motion.ts`):

| Spring | Feel | Used by |
|---|---|---|
| `snappy` | no overshoot | buttons, chips, presence |
| `gentle` | settled | cards, list items |
| `bouncy` | a little physical | sheets, modals, camera |
| `pop` | playful | reactions, badges, stickers |

| Interaction | Behaviour |
|---|---|
| Page change | fade + 10px rise (`pageVariants`) |
| Tab change | pill slides between tabs; panes cross-fade |
| Presence ring | breathes on a 3s loop while someone is online |
| Speaking ring | green, gently pulsing, held 700ms–1.6s past the last sound |
| Recording | red dot pulses; the live waveform draws from the mic |
| Typing | three dots bouncing on a 1.15s stagger |
| Reply arming | quote chip springs in above the composer |
| Drill-down / back | horizontal push (`pushVariants`) |
| Camera & preview | rise from the bottom with a spring |
| Card / button press | scale 0.985 / 0.97 |
| Capture button | scale 0.88 + soft repeating halo |
| New moment | fade + 18px rise, staggered 55ms |
| Reaction | pop-in, count rolls up |
| Presence change | colour crossfade, dot scales 0.88 ↔ 1 |
| Nav tab | `layoutId` blob glides between tabs |
| Segmented tabs | `layoutId` pill slides |
| Someone joins | toast floats down from the top with their face, auto-dismisses |
| Voice starts | same whisper, 🎙️ instead of ✨ |
| Reconnecting | a dark strip drops in; the room stays put underneath |

`prefers-reduced-motion` collapses every animation to ~0 and removes the WebGL layer entirely.

---

## 6. The 3D layer

Two pieces, both decorative, both degradable:

- **`Ambient`** — a Three.js scene of five pastel blobs (custom gradient + rim shader) drifting
  behind the onboarding and profile heroes. Capped at 1.35 DPR, heavily blurred, veiled by a warm
  gradient, paused when the tab is hidden, lazy-loaded so it never blocks first paint, and replaced
  by a CSS gradient when WebGL or motion is unavailable.
- **`PhotoStack`** — the onboarding collage. Real photographs in a CSS `preserve-3d` space that
  tilts with the pointer or the phone's gyroscope. DOM rather than WebGL on purpose: no CORS
  surface, and a slow image still shows its card.

---

## 7. Components

**Shell** `AppShell` `ScreenSwap` `TopBar` `RoomHeader` `Segmented` `BottomNav` `CameraButton`

**People** `Avatar` `PresenceDot` `AvatarStack` `PeopleRail` `LiveNow` `LiveTab` `ActivityRow`
`ActivityPicker` `RoomPulse`

**Content** `RoomCard` `MomentCard` `ReactionBar` `ReactionBurst` `ChatTab` `MediaGallery`
`MediaViewer`

**Voice** `Composer` `VoiceNote` `Waveform` `VoiceRoom`

**Room chrome** `RoomMenu` `RoomSettings` `RoomSearch`

**Feedback** `BottomSheet` `Modal` `ToastProvider` `Skeleton` `RoomsSkeleton` `MomentsSkeleton`
`EmptyState` `ErrorState` `Connecting` `ConnectionBanner`

**Atmosphere** `Ambient` `PhotoStack`

Shared CSS primitives: `.btn` (+ `--primary/--ink/--soft/--tinted/--ghost/--danger/--block/--sm`),
`.icon-btn`, `.pill`, `.card`, `.glass`, `.input`, `.opt-row`, `.skeleton`, `.rail`, `.gutter`,
`.wave`, `.toggle`.

### The room's own surfaces

| Surface | Shape |
|---|---|
| Tabs | Live / Moments / Chat, a soft pill sliding between them (`layoutId`) |
| Presence cell | 68px face, a presence-coloured ring that breathes while online, activity emoji badge, name, current activity |
| Voice CTA | One row: what's happening on voice, the faces already on it, one button |
| Status card | Your face, what you're up to, one tap to change it |
| Composer | Glass bar: camera · field · ＋ · mic-or-send. Holding the mic swaps the bar for a live waveform |
| Voice note | Play, 48-bar waveform (seekable), duration, speed cycle, delete-if-mine |
| Chat row | Runs collapse by author; my messages take the room's mood colour |
| Voice room | Full screen, big faces, green ring while speaking, four controls |
| Media gallery | All / Photos / Videos / Voice, with durations and waveform thumbnails |

---

## 8. Voice

Human, short, lowercase-friendly.

> "Your people" · "Live now" · "Just posted" · "What's happening?" · "Say something…" ·
> "Bring your people in" · "You're all caught up" · "Nothing here yet." ·
> "Your people are waiting ✨" · "Talk to everyone" ·
> "Start a voice room — no ringing, people just drop in" · "‹ slide to cancel" ·
> "Hold the mic a little longer to record." · "Something went wrong." / "Let's try that again."

Never: "Error 500", "No data available", "Users", "Content", "Feed".

---

## 9. Mobile rules

Designed at **360 / 375 / 390 / 412** and verified at 360 and 412. On wider screens the app becomes
a centred `--app-max` (460px) column rather than stretching into a dashboard.

- `env(safe-area-inset-*)` respected top and bottom (`--safe-top`, `--safe-bottom`).
- Touch targets ≥ 44px; primary buttons 52–56px.
- The floating nav reserves `--nav-space` at the bottom of every scrolling screen.
- Horizontal rails are full-bleed with gutter-aligned first items and hidden scrollbars.
- `viewport-fit=cover`, no user scaling, no tap highlight.

---

## 10. Accessibility

- Every icon-only control carries an `aria-label`; tabs use `role="tab"` + `aria-selected`,
  toggles use `role="switch"` + `aria-checked`, the waveform is a labelled `role="slider"`.
- Minimum touch target is 44px — the composer icons, the mic, the voice controls and the nav all
  meet it.
- Focus is visible everywhere: a 2.5px accent ring, except on fields inside a chrome-less bar,
  where the bar itself lights up instead.
- `prefers-reduced-motion` collapses every animation and removes the WebGL layer.
- Type scales with the user's root font size; nothing is pinned in `px` except hairlines and icons.
- The media viewer is a labelled `role="dialog"` and answers Escape and the arrow keys.
