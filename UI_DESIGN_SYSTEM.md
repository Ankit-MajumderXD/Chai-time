> **Superseded.** This was the first-pass palette (the `--chai` / `--spice` tokens).
> The design system the app actually ships is [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md),
> and the live tokens are in `client/src/design/tokens.css`. Kept for reference.

# Chai Time — UI Design System

## Brand Identity

**Name**: Chai Time
**Tagline**: "Same moment, everywhere."
**Personality**: Warm, intimate, playful, spontaneous
**Category**: Private real-time social capture

---

## 1. Colors

### Primary Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--chai` | `#E8A87C` | Primary brand, CTAs, accents |
| `--chai-dark` | `#C4855C` | Hover states, emphasis |
| `--chai-light` | `#F5D5C0` | Backgrounds, tints |
| `--spice` | `#D35D6E` | Alerts, live indicators, recordings |
| `--mint` | `#6AB19B` | Success, online, captured |
| `--gold` | `#E8C547` | Rewards, celebrations, highlights |

### Neutrals

| Token | Hex | Usage |
|-------|-----|-------|
| `--ink` | `#1A1A2E` | Primary text |
| `--slate` | `#4A4A68` | Secondary text |
| `--mist` | `#8E8EA0` | Tertiary text, placeholders |
| `--cloud` | `#E8E8F0` | Borders, dividers |
| `--snow` | `#F8F8FC` | Backgrounds |
| `--white` | `#FFFFFF` | Cards, surfaces |

### Dark Mode

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-dark` | `#0F0F1A` | Page background |
| `--surface-dark` | `#1A1A2E` | Card background |
| `--surface-elevated` | `#252540` | Elevated cards, modals |
| `--border-dark` | `#2A2A45` | Borders in dark mode |

### Semantic Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--success` | `#6AB19B` | `#5DA88F` | Success states |
| `--warning` | `#E8C547` | `#D4B43E` | Warnings |
| `--error` | `#D35D6E` | `#C44E5E` | Errors, destructive |
| `--info` | `#5B8DEF` | `#4A7DE0` | Informational |

---

## 2. Typography

### Font Stack

```css
--font-primary: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 
                'Segoe UI', Roboto, 'Noto Sans', sans-serif;
--font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
```

### Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-hero` | 32px | 800 | 1.1 | Hero headlines |
| `--text-h1` | 24px | 700 | 1.2 | Page titles |
| `--text-h2` | 20px | 700 | 1.3 | Section headers |
| `--text-h3` | 17px | 600 | 1.3 | Card titles |
| `--text-body` | 15px | 400 | 1.5 | Body text |
| `--text-body-semibold` | 15px | 600 | 1.5 | Emphasized body |
| `--text-caption` | 13px | 400 | 1.4 | Captions, timestamps |
| `--text-small` | 11px | 500 | 1.3 | Labels, badges |
| `--text-tiny` | 10px | 600 | 1.2 | Micro labels |

### Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--tracking-tight` | -0.02em | Headlines |
| `--tracking-normal` | 0 | Body |
| `--tracking-wide` | 0.04em | Labels, uppercase |
| `--tracking-wider` | 0.08em | Micro labels |

---

## 3. Spacing

### Base Unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| `--space-0` | 0 | Reset |
| `--space-1` | 4px | Tight inline |
| `--space-2` | 8px | Element gap |
| `--space-3` | 12px | Card padding |
| `--space-4` | 16px | Screen margin |
| `--space-5` | 20px | Large gap |
| `--space-6` | 24px | Section spacing |
| `--space-8` | 32px | Major sections |
| `--space-10` | 40px | Page top/bottom |
| `--space-12` | 48px | Hero spacing |

### Screen Padding

| Breakpoint | Horizontal | Vertical |
|------------|------------|----------|
| Mobile (< 480px) | 16px | 16px |
| Tablet (480-768px) | 24px | 20px |
| Desktop (> 768px) | 32px | 24px |

---

## 4. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | 6px | Badges, chips |
| `--radius-sm` | 10px | Small cards, inputs |
| `--radius-md` | 14px | Cards, buttons |
| `--radius-lg` | 20px | Modals, sheets |
| `--radius-xl` | 28px | Large cards, hero |
| `--radius-full` | 9999px | Pills, avatars, FABs |

---

## 5. Shadows

### Light Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | Cards |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` | Elevated elements |
| `--shadow-xl` | `0 16px 48px rgba(0,0,0,0.16)` | Modals, FABs |

### Dark Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm-dark` | `0 1px 2px rgba(0,0,0,0.2)` | Subtle lift |
| `--shadow-md-dark` | `0 4px 12px rgba(0,0,0,0.3)` | Cards |
| `--shadow-lg-dark` | `0 8px 24px rgba(0,0,0,0.4)` | Elevated elements |

---

## 6. Icon Sizes

| Token | Size | Stroke | Usage |
|-------|------|--------|-------|
| `--icon-xs` | 14px | 1.5px | Inline tiny |
| `--icon-sm` | 18px | 1.5px | Inline small |
| `--icon-md` | 22px | 2px | Navigation, buttons |
| `--icon-lg` | 28px | 2px | Feature icons |
| `--icon-xl` | 36px | 2.5px | Hero icons |

**Style**: Outlined or duotone, rounded line caps.

---

## 7. Avatar Sizes

| Token | Size | Usage |
|-------|------|-------|
| `--avatar-xs` | 28px | Inline reactions |
| `--avatar-sm` | 36px | Comments, lists |
| `--avatar-md` | 44px | Cards, headers |
| `--avatar-lg` | 56px | Profiles, featured |
| `--avatar-xl` | 72px | Profile page |

**Shape**: Circular (50% radius)
**Border**: 2px solid surface color

---

## 8. Button Sizes

### Primary Button

| Token | Height | Padding | Font | Radius | Usage |
|-------|--------|---------|------|--------|-------|
| `--btn-sm` | 32px | 12px 16px | 13px/600 | 8px | Inline actions |
| `--btn-md` | 40px | 16px 24px | 15px/600 | 10px | Standard actions |
| `--btn-lg` | 48px | 20px 32px | 16px/700 | 12px | Primary CTAs |
| `--btn-xl` | 56px | 24px 40px | 17px/700 | 14px | Hero CTAs |

### Icon Button

| Token | Size | Icon | Radius | Usage |
|-------|------|------|--------|-------|
| `--icon-btn-sm` | 32px | 16px | 8px | Compact |
| `--icon-btn-md` | 40px | 20px | 10px | Standard |
| `--icon-btn-lg` | 48px | 24px | 12px | Prominent |

### Camera FAB

| Property | Value |
|----------|-------|
| Size | 64px |
| Icon | 28px |
| Radius | 50% (circle) |
| Shadow | `--shadow-xl` |
| Position | Bottom center, 24px from edge |

---

## 9. Animation Timings

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `--duration-instant` | 100ms | ease-out | Micro-interactions |
| `--duration-fast` | 150ms | ease-out | Button states, toggles |
| `--duration-normal` | 250ms | ease-out | Page transitions |
| `--duration-slow` | 350ms | ease-out | Modal open/close |
| `--duration-slower` | 500ms | ease-out | Complex animations |

### Easing Curves

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Most transitions |
| `--ease-in-out` | `cubic-bezier(0.45, 0, 0.55, 1)` | Page transitions |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy elements |
| `--ease-bounce` | `cubic-bezier(0.68, -0.55, 0.27, 1.55)` | Playful pops |

---

## 10. Component States

### Button States

| State | Visual Change |
|-------|---------------|
| Default | Base style |
| Hover | +5% brightness, shadow increase |
| Active/Pressed | Scale(0.97), -5% brightness |
| Disabled | 50% opacity, no pointer events |
| Loading | Spinner replaces text, disabled |

### Card States

| State | Visual Change |
|-------|---------------|
| Default | Base style |
| Hover (desktop) | +shadow, slight elevation |
| Active/Pressed | Scale(0.98) |
| Selected | Border color change, subtle bg |

### Input States

| State | Visual Change |
|-------|---------------|
| Default | Border: `--cloud`, bg: `--white` |
| Focus | Border: `--chai`, ring: `--chai-light` |
| Error | Border: `--error`, error text below |
| Disabled | Bg: `--snow`, text: `--mist` |
| Placeholder | Text: `--mist` |

---

## 11. Layout Grid

### Mobile First

```
┌─────────────────────────┐
│ ← Header (56px)         │
├─────────────────────────┤
│                         │
│   Content Area          │
│   (scrollable)          │
│                         │
│                         │
├─────────────────────────┤
│ 📷  🏠  🔔  👤         │
│ Bottom Nav (64px)       │
└─────────────────────────┘
```

### Breakpoints

| Name | Width | Columns | Gutter |
|------|-------|---------|--------|
| Mobile | < 480px | 4 | 16px |
| Tablet | 480-768px | 8 | 20px |
| Desktop | > 768px | 12 | 24px |

---

## 12. Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-base` | 0 | Default |
| `--z-above` | 10 | Above siblings |
| `--z-sticky` | 100 | Sticky headers |
| `--z-overlay` | 200 | Overlays, backdrops |
| `--z-modal` | 300 | Modals, sheets |
| `--z-toast` | 400 | Toast notifications |
| `--z-max` | 500 | Camera, full-screen |

---

## 13. Interaction Patterns

### Pull to Refresh
- Custom animation (tea cup filling)
- 60px trigger threshold
- Spring-back on release

### Swipe Actions
- Left swipe: Reply, React
- Right swipe: Dismiss, Back
- 80px reveal threshold

### Long Press
- 500ms threshold
- Haptic feedback (if available)
- Context menu appears

### Double Tap
- 300ms threshold
- Heart/like animation
- Haptic feedback

---

## 14. Empty States

### No Rooms
```
🫖
No rooms yet
Create a room to start sharing moments with friends.

[Create Room]
```

### No Moments
```
📷
No moments yet
Be the first to capture what you're doing right now.

[Take a Photo]
```

### Loading
```
Skeleton screens with pulse animation
Match content layout exactly
```

---

## 15. Responsive Behavior

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Header | Full width, compact | Centered, spacious | Max-width 480px |
| Cards | Full width | 2-column grid | 2-column grid |
| Camera FAB | Bottom center | Bottom center | Bottom center |
| Bottom Nav | Full width | Centered | Centered |
| Modals | Full screen | Centered card | Centered card |

---

## 16. Accessibility

- **Touch targets**: Minimum 44x44px
- **Color contrast**: 4.5:1 for text, 3:1 for large text
- **Focus indicators**: Visible ring on keyboard focus
- **Screen reader**: Meaningful labels on all interactive elements
- **Reduced motion**: Respect `prefers-reduced-motion`
- **Text scaling**: Support up to 200% zoom

---

## 17. Motion Principles

1. **Purposeful**: Every animation communicates state change
2. **Snappy**: Under 300ms for most transitions
3. **Smooth**: 60fps, no jank
4. **Consistent**: Same element, same animation everywhere
5. **Subtle**: Enhance, don't distract

---

## 18. Dark Mode Strategy

- Automatic based on system preference
- Manual toggle in settings
- All tokens have dark mode variants
- No pure black (#000) — use `--bg-dark`
- Elevated surfaces get lighter, not darker
- Shadows become more subtle in dark mode
- Accent colors maintain vibrancy

---

*Design system version 1.0 — Created for Chai Time*
*Inspired by Setlog's category, not its exact implementation*
