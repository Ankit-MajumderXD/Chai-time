# Setlog UI/UX Analysis

## Overview

Setlog is a private, camera-first social app for small groups (2-20 friends) to share 2-3 second video clips throughout the day. It creates auto-stitched daily vlogs from these moments. The app is intentionally raw, unedited, and low-pressure.

**Tagline**: "share everyday moments with your friends"
**Category**: Social Networking
**Platform**: iOS + Android
**Developer**: New Chat Inc.

---

## 1. Overall Visual Style

- **Bright, colorful, and unapologetically playful** (Vogue SG)
- Less polished than Instagram, more structured than BeReal
- Feels like a "digital scrapbook" rather than a social feed
- Warm, inviting color palette (not cold/techy)
- Rounded corners everywhere — nothing feels sharp or corporate
- Generous white space — rooms to breathe
- Typography is clean and modern, not decorative

**Key Insight**: The UI feels like a cozy private space, not a public stage.

---

## 2. Home Screen Structure

- **Room list**: Cards showing each "log room" (group)
- Each card displays: room name, member avatars, last activity timestamp
- Create new room button prominently placed
- Minimal chrome — the rooms ARE the content
- No infinite scroll, no algorithmic feed
- Personal rooms vs. friend rooms clearly separated

**Layout**:
```
┌─────────────────────┐
│  My Rooms            │
│                      │
│  ┌─────────────────┐ │
│  │ 🏠 Family ❤️    │ │
│  │ 👤👤👤👤 5ppl   │ │
│  │ Last: 2h ago    │ │
│  └─────────────────┘ │
│                      │
│  ┌─────────────────┐ │
│  │ 🎉 Birthday     │ │
│  │ 👤👤👤 3ppl     │ │
│  │ Last: 1d ago    │ │
│  └─────────────────┘ │
│                      │
│  [+ Create Room]     │
└─────────────────────┘
```

---

## 3. Navigation

- **Bottom tab bar** with 3-4 tabs:
  - Home (rooms list)
  - Camera (center, prominent)
  - Activity/Notifications
  - Profile/Settings
- Camera button is the hero — largest, centered, distinct color
- Minimal top header — just room name + settings gear
- Back navigation is always available
- No hamburger menu — everything accessible from tabs

---

## 4. Bottom Navigation

- Fixed at bottom, always visible
- Camera button is elevated/larger than other tabs
- Active tab has distinct color indicator
- Smooth transitions between tabs
- No labels on icons (clean look)
- Slight blur/transparency on scroll

**Design**: Camera-first — the capture action is the primary CTA.

---

## 5. Camera-First Interaction

- **Open camera → Capture → Preview → Send**
- Camera opens instantly (no loading)
- Minimal overlay: just shutter button + flash toggle
- 2-3 second recording limit (or photo)
- No editing, no filters, no beauty mode
- Timer option (3-second delay for posing)
- Front/back camera toggle
- Portrait and landscape support
- Preview shows clip immediately after capture
- One-tap send to room

**Key Insight**: The camera is the CORE loop. Everything else supports getting to the camera fast.

---

## 6. Room/Group UI

- **Split-screen grid**: Shows all members' latest clips simultaneously
- Real-time updates — clips appear as they're posted
- Grid layout adapts to member count (2x2, 3x3, etc.)
- Each cell shows: avatar + name + clip thumbnail
- Tap to expand any clip to full screen
- Scroll vertically to see timeline of past moments
- Hourly prompts appear as banners above the grid
- Countdown timer for current capture window

**Layout**:
```
┌─────────────────────┐
│ Family ❤️     ⋮     │
│ 5 people             │
│ 👤 👤 👤 👤 👤       │
├─────────────────────┤
│                      │
│ ┌──────┐ ┌──────┐   │
│ │ Mom  │ │ Dad  │   │
│ │ 📸   │ │ 📸   │   │
│ └──────┘ └──────┘   │
│ ┌──────┐ ┌──────┐   │
│ │ Me   │ │ Sis  │   │
│ │ 📸   │ │ 📸   │   │
│ └──────┘ └──────┘   │
│ ┌──────┐             │
│ │ Bro  │             │
│ │ 📸   │             │
│ └──────┘             │
│                      │
│ 📷 Capture Moment    │
└─────────────────────┘
```

---

## 7. Friend/Avatar Presentation

- Circular emoji or photo avatars
- Names displayed below avatars
- Online/presence indicators (subtle glow or dot)
- Member count shown in room header
- Horizontal scrollable avatar row for large groups
- Tap avatar to see member profile/stats
- "You" indicator on your own avatar

---

## 8. Moment/Feed Layout

- **Vertical timeline**: Moments stacked chronologically
- Each moment card shows:
  - Member name + avatar
  - Timestamp (relative: "2h ago")
  - Clip/photo (auto-playing)
  - Text caption (optional)
  - Reactions row
  - Reply count (if any)
- Cards have generous padding
- Subtle dividers between moments
- "Full house" celebration when everyone posts
- Empty state encourages first capture

---

## 9. Typography

- **Primary**: System font (SF Pro / Roboto)
- **Headings**: Bold, 18-24px
- **Body**: Regular, 14-16px
- **Captions**: Light, 12-13px
- **Labels**: Medium, 11-12px, uppercase tracking
- Line height: 1.4-1.5 for readability
- No decorative fonts — clean and functional

---

## 10. Spacing

- **Base unit**: 4px grid
- **Screen padding**: 16-20px horizontal
- **Card padding**: 12-16px
- **Element spacing**: 8-12px
- **Section spacing**: 24-32px
- **Tight spacing** (inline elements): 4-6px

Consistent spacing creates visual rhythm without being rigid.

---

## 11. Cards

- **Border radius**: 12-16px (very rounded)
- **Background**: Slightly lighter than page bg (or white on dark)
- **Shadow**: Subtle, diffuse (not harsh)
- **Padding**: 12-16px
- **No hard borders** — shadows and bg contrast define edges
- **Hover state**: Slight elevation increase
- **Active state**: Subtle scale down (0.98)

---

## 12. Buttons

- **Primary**: Filled, rounded, bold text
- **Secondary**: Outlined or ghost style
- **Icon buttons**: Circular, 40-44px touch target
- **Camera button**: Extra large, 56-64px, elevated
- **Padding**: 12-16px vertical, 24-32px horizontal
- **Border radius**: 12px (pill shape for large buttons)
- **Active state**: Scale down + color shift
- **Disabled state**: 50% opacity

---

## 13. Icons

- **Style**: Outlined or duotone (not filled)
- **Size**: 20-24px for navigation, 16-20px for inline
- **Weight**: Regular (not bold/thin)
- **Consistent stroke width**: 1.5-2px
- **Custom icons** for brand elements
- **Emoji** used liberally as decorative elements

---

## 14. Border Radius

- **Small elements** (badges, chips): 8px
- **Cards**: 12-16px
- **Buttons**: 12px (pill for large)
- **Images**: 12-16px
- **Avatars**: 50% (circle)
- **Modals/Sheets**: 16-20px top corners

Consistent radius creates a soft, approachable feel.

---

## 15. Colors

Based on public screenshots and descriptions:

- **Primary**: Warm coral/orange (#FF6B35 or similar)
- **Secondary**: Soft yellow/gold (#FFD166)
- **Background**: Light cream or dark charcoal
- **Surface**: White or slightly off-white
- **Text Primary**: Near-black (#1A1A1A)
- **Text Secondary**: Medium gray (#666666)
- **Accent**: Vibrant pink or teal for CTAs
- **Success**: Soft green
- **Error**: Soft red
- **Neutral**: Warm grays (not cool/blue-toned)

**Dark Mode**: Available, uses deep charcoal (#121212) not pure black.

---

## 16. Empty States

- **Friendly illustration** (not technical)
- **Clear copy**: "No moments yet — capture your first!"
- **Single CTA**: "Take a photo" button
- **Encouraging tone**: Playful, not clinical
- **Example content**: Shows what it WILL look like

---

## 17. Loading States

- **Skeleton screens** for content areas
- **Pulse animation** on loading placeholders
- **Spinner** for button actions
- **Progress bar** for uploads
- **Optimistic updates** — show content immediately, sync in background

---

## 18. Animations

- **Micro-interactions**: Button press, toggle switch, tab switch
- **Transitions**: 200-300ms ease-out
- **Page transitions**: Slide horizontal (not fade)
- **Element entrance**: Subtle fade-up (not bounce)
- **Camera shutter**: Quick flash effect
- **Reaction pop**: Scale up + bounce
- **Pull to refresh**: Custom animation

**Key**: Animations feel snappy, not sluggish. 60fps target.

---

## 19. Transitions

- **Tab switch**: Cross-fade (150ms)
- **Modal open**: Slide up from bottom (300ms)
- **Card tap**: Expand to detail (250ms)
- **Back navigation**: Reverse of forward
- **Loading → Content**: Fade in (200ms)

No jarring cuts — every state change feels connected.

---

## 20. Gesture Interactions

- **Tap**: Select, open, activate
- **Long press**: Preview, context menu
- **Swipe left/right**: Navigate between moments
- **Swipe down**: Dismiss modal/sheet
- **Pull down**: Refresh content
- **Pinch**: Zoom into photos/clips
- **Double tap**: Like/react

Gestures are intuitive and match platform conventions.

---

## 21. Camera UI

- **Full screen**: Camera takes entire viewport
- **Minimal overlay**: Shutter button + flash toggle
- **Timer option**: 3-second countdown
- **Front/back toggle**: Top right corner
- **Flash control**: Top left corner
- **No grid lines**: Keep it simple
- **No mode switcher**: Photo OR video, not both
- **Shutter button**: Large, centered, distinct color

**Post-Capture**:
- Preview fills screen
- "Send" button prominent
- "Retake" option available
- Optional text caption

---

## 22. Posting Flow

```
Open Camera (tap 📷)
    ↓
Capture (hold shutter or tap)
    ↓
Preview (full screen)
    ↓
Optional: Add text caption
    ↓
Send to Room (tap send)
    ↓
Return to Room (auto)
    ↓
Moment appears in grid (real-time)
```

**Total time target**: < 5 seconds from open to posted.

---

## 23. Real-Time Interactions

- **Moments appear instantly** for all room members
- **Reactions update live** (no refresh needed)
- **Presence indicators** show who's online
- **Typing indicators** for replies (if implemented)
- **Pull-to-refresh** as fallback
- **Optimistic UI** — your action shows immediately, syncs in background

Powered by SpacetimeDB subscriptions in our implementation.

---

## 24. Profile UI

- **Minimal profile**: Name + avatar + rooms list
- **No follower counts** — private by design
- **Settings accessible** from profile
- **Notification preferences**
- **Account management** (simple)
- **Stats**: Total moments captured, days active

---

## 25. Invite/Join-Room Flow

**Creating a Room**:
1. Tap "Create Room"
2. Enter room name
3. Choose emoji/avatar
4. Room created with shareable code/link
5. Share via messaging apps

**Joining a Room**:
1. Receive link/code from friend
2. Tap link → opens app
3. Enter name + choose avatar
4. Join room instantly
5. See existing members + content

**Key**: No signup required. Identity = device/browser.

---

## What Makes Setlog Feel Like Setlog

1. **Camera-first**: Everything leads to capture
2. **Private by default**: Small groups, no public feed
3. **Raw & unedited**: No filters, no retakes
4. **Real-time**: See friends' moments as they happen
5. **Low pressure**: 2-3 seconds, no creation anxiety
6. **Rhythm**: Hourly prompts create daily ritual
7. **Intimate**: Know what friends are doing RIGHT NOW
8. **Playful**: Emoji, color, fun copy
9. **Fast**: Open → capture → share in seconds
10. **Authentic**: Real life, not highlight reel

---

## What We Should Improve (Not Copy)

1. **Better onboarding**: Show, don't tell
2. **Clearer room management**: Easier to switch rooms
3. **Notification control**: Less intrusive than hourly alarms
4. **Export options**: Easier to save/share compiled vlogs
5. **Status options**: Beyond just "sleeping" for missed slots
6. **Text overlay controls**: Better font/color choices
7. **Search/filter**: Find specific moments in timeline
8. **Reactions variety**: More emoji options
9. **Reply threads**: Deeper conversations on moments
10. **Calendar view**: Browse past days easily

---

## Our Differentiation (Chai Time)

1. **Prompt-driven**: Synced prompts create shared experience
2. **Voice + Photo**: Not just video clips
3. **No hourly pressure**: Capture when prompted, not on schedule
4. **Roast mode**: Fun toggle for friend groups
5. **Custom prompts**: Users write their own moments
6. **Progress tracking**: See who's captured, who hasn't
7. **Full house celebration**: When everyone participates

---

*Analysis based on: Play Store listing, App Store listing, Vogue SG article, SCMP article, Korea Herald article, K-Gallery article, MWM analysis, LinkedIn PM analysis, and user reviews.*
