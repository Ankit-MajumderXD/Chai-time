# Chai Time — UI Architecture

React 18 + Vite + Framer Motion + Three.js + WebRTC on the client; **SpacetimeDB is the only source
of truth**. There is no local store, no cache layer, no polling. Every screen is a live projection
of the database, so a row changing on the server *is* the re-render.

---

## 1. Layout of the repo

```
spacetimedb/src/
  tables.ts                 every table definition
  index.ts                  module entry: schema, reducers, lifecycle, timers
client/src/
  main.tsx                  connection + SpacetimeDBProvider
  App.tsx                   one subscription, routing, onboarding gate, reconnect
  design/
    tokens.css              colour, type, space, radius, elevation, blur, motion
    base.css                reset, app frame, primitives (btn, pill, input, card…)
    components.css          shell, home, moments, camera, profile
    room.css                the room: presence, chat, voice, composer, gallery
    motion.ts               springs + shared Framer variants
  lib/
    router.tsx              ~130-line history router with a direction hint
    upload.ts               the media pipeline (object storage ⇄ dev fallback)
    audio.ts                voice recording, waveform extraction, shared AudioContext
    rooms.ts                room moods, photo helpers, activity presets
    format.ts               timeAgo, greeting, initials, memberSummary
    codes.ts                6-char invite codes (no 0/O/1/I)
    haptics.ts              navigator.vibrate wrapper
  data/                     the seam between React and SpacetimeDB
    db.ts                   useConn / useConnection / call()
    useSession.ts           who am I, do I have a profile
    useRooms.ts             my rooms + "your people"
    useRoom.ts              one room fully assembled
    useVoice.ts             the WebRTC mesh, signalled through SpacetimeDB
    usePresence.ts          viewing + typing side-effects
    useNow.ts               one shared ticking clock
  components/               22 reusable pieces (see DESIGN_SYSTEM.md §7)
  screens/                  Onboarding Rooms Room Members Camera PostPreview
                            CreateRoom Invite JoinRoom Profile Settings
  scripts/e2e.ts            two-client real-time proof (`npm run e2e`)
```

---

## 2. Data model

Everything room-scoped references a **`room_member` row id**, never an `Identity`. That keeps
authorship uniform across real members and seeded demo members (who have no identity behind them).

```
person            id, identity(unique), handle, displayName, avatarUrl, bio
room              id, code(unique), name, emoji, kind, coverUrl, isEvent, ownerId, lastActivityAt
room_member       id, roomId, personId(0 = demo), displayName, avatarUrl,
                  status, activity, activityEmoji, viewing, typingUntil, lastSeenAt
media             id, roomId, memberId, kind(photo|video|voice), url, mimeType,
                  width, height, durationMs, sizeBytes, waveform
moment            id, roomId, memberId, kind, mediaId(0 = text), caption
message           id, roomId, memberId, kind(text|photo|video|voice), text, mediaId,
                  momentId(0 = not a reply)
reaction          id, momentId, memberId, emoji
room_event        id, roomId, kind(created|joined|left|posted|voice_started|voice_ended), text
voice_session     id, roomId(unique), startedBy, startedAt
voice_participant id, sessionId, roomId, memberId, personId, muted, speakingUntil
signal            id, sessionId, fromMemberId, toMemberId, kind(offer|answer|ice|bye), payload
```

Three decisions worth calling out:

- **Presence lives on the membership row.** One query gives a room its people *and* what they're
  doing — no separate presence table to join or keep in sync.
- **A reply is a message that quotes a moment.** There is no separate `reply` table: a `message`
  with a `momentId` appears both under the moment and in the room's conversation, so the thread and
  the chat are the same rows rather than two parallel systems.
- **Voice activity is a timestamp, not a flag.** `speakingUntil` expires on its own, so a client
  that crashes mid-sentence doesn't leave a ring lit forever. `typingUntil` works the same way.

### Reducers

`saveProfile` · `createRoom` · `joinRoom` · `leaveRoom` · `updateRoom` · `removeMember` ·
`deleteRoom` · `setActivity` · `setViewing` · `setTyping` · `postMoment` · `deleteMoment` ·
`toggleReaction` · `sendMessage` · `deleteMessage` · `startVoice` · `joinVoice` · `leaveVoice` ·
`setMuted` · `pingSpeaking` · `sendSignal` · `consumeSignal` · `seedDemoRooms`

Lifecycle: `init`, `clientConnected`, `clientDisconnected` (which also pulls you out of voice —
a ghost in a call is worse than a ghost in a member list). Two scheduled reducers: `demoTick`
(~9s, stirs the demo rooms) and `sweep` (~20s, expires stale signalling and closes empty voice
rooms).

Invite codes are generated **client-side** (`lib/codes.ts`) because reducers cannot return values.

---

## 3. Media architecture

**Bytes never live in a row.** `postMoment` and `sendMessage` take a media *reference* — url, mime
type, dimensions, duration, waveform — and write a `media` row, which is exactly the shape an object
store hands back.

```
capture ──▶ lib/upload.ts ──▶ VITE_MEDIA_UPLOAD_URL?  ──yes──▶ presign → PUT to R2/S3 → public URL
                                                      ──no───▶ data URL (local dev only)
                             │
                             └─▶ MediaRef { url, mimeType, width, height, durationMs, waveform }
                                      │
                                      └─▶ reducer writes a `media` row and points the
                                          moment/message at its id
```

Photos are downscaled to a 1280px long edge before upload; videos are probed for duration and frame
size; voice notes carry a 48-bar waveform computed once at record time (`lib/audio.ts`), so a note
draws instantly before a byte of audio has downloaded. Setting `VITE_MEDIA_UPLOAD_URL` is the only
change needed for production — the schema, the reducers and the UI are untouched.

---

## 4. Voice architecture

Audio never touches the database.

```
SpacetimeDB          WebRTC
─────────────        ──────────────
voice_session        RTCPeerConnection (mesh, one per pair)
voice_participant    local mic track ──▶ peers
  muted, speakingUntil                  peers ──▶ <audio> sinks
signal  ⇄ offers / answers / ICE
```

- The lower `memberId` always makes the offer, so there is never any glare.
- Signalling rows are **single-use**: the recipient applies then calls `consumeSignal`, and `sweep`
  deletes anything unclaimed after 45s.
- Voice activity is measured locally from an `AnalyserNode` and published as `pingSpeaking`
  (throttled to ~1/s). Every client draws speaking rings from that timestamp, so the rings work even
  where the peer connection doesn't.
- Your own ring uses a 700ms hold so it doesn't strobe on every syllable — matching the 1.6s window
  the server holds for everyone else.
- A mesh is right for 5–15 people in a private room. Beyond that you would put an SFU in the middle
  and keep this exact signalling layer.

---

## 5. Subscription strategy

`App.tsx` opens **one** subscription for the whole session, covering all eleven tables. One
subscription, one lifetime, no overlapping queries. Screens never touch the connection to *read*;
they call `useTable(...)` and derive. Writes go through `data/db.ts#call()`, which surfaces a
rejection as a toast rather than swallowing it.

**Scaling note:** a production build would narrow this to per-room queries grouped by lifetime —
subscribe-then-unsubscribe when switching rooms, and only pull `media`/`message` for the open room.
The derivation layer isolates that change to `data/`.

---

## 6. Derivation layer

Each hook does exactly one join, memoised:

- **`useSession`** — finds my `person` row by identity hex. `hasProfile` is the entire auth gate.
- **`useRooms`** — rooms I'm in, sorted by most recent moment, each with members, active count,
  latest moment and the newest picture to use as a cover; plus a de-duplicated "your people" list
  ranked by presence.
- **`useRoom(code)`** — members (online → away → offline), me, viewing, typing, moments with
  reaction tallies and quoted replies, chat messages grouped into runs, the media gallery, the event
  ticker, and the voice roster.
- **`useVoice`** — the mesh, the mic, mute/deafen, and local voice-activity detection.

Three deliberate details:

1. **Auto-increment ids are not ordered.** Everything sorts by `createdAt`/`lastActivityAt`.
2. **Typing and voice activity are derived outside the main memo.** They expire on a clock, not on
   a row change; keeping them inside would hand every moment card a new object identity once a
   second and restart its entrance animation.
3. **`useNow` is a shared external store** — one interval per tick rate, shared by every subscriber,
   paused while the tab is hidden. It is a clock, not a poll; it fetches nothing.

---

## 7. The room screen

Three tabs, in the order the hierarchy demands:

| Tab | What it answers |
|---|---|
| **Live** | Who is here, what they're doing, who's on voice, what am *I* up to |
| **Moments** | What people shared — photo, video, voice note or text, with reactions |
| **Chat** | What people said, including replies that quote a moment |

The composer is fixed above the bottom navigation on Moments and Chat. Live has no composer on
purpose: its actions are the status card and the voice room. Tapping reply on a moment arms a quote
and hands the conversation to Chat.

### Real-time surfaces

| What you see | Where it comes from |
|---|---|
| "3 active · 2 viewing" | `room_member.status` / `.viewing`, written by `setViewing` |
| "Mom is typing…" | `room_member.typingUntil`, debounced ping from the composer |
| "Aisha joined the room ✨" | a `room_event` insert → a toast with their face on it |
| A moment appearing | `moment` insert → fade + rise, staggered |
| A reaction popping | `reaction` insert/delete → spring pop with three sparks |
| Someone's activity changing | `room_member.activity` update → crossfade in place |
| A speaking ring lighting up | `voice_participant.speakingUntil` |
| "Reconnecting…" | `isActive` from the SDK; the room stays on screen underneath |

Opening a room writes `viewing: true`; leaving, backgrounding or closing the tab writes it back, with
a 45s heartbeat for long sessions.

### Demo rooms

A brand-new account gets three seeded rooms (Family, Goa Trip, College Friends) with real people,
photos, chat and reactions. The demo members live in the **same tables** as everyone else, so every
screen, subscription and animation exercises the real code path. `demoTick` drifts their activities,
starts typing indicators, and occasionally posts — each change is an ordinary row update pushed to
every subscriber. Nothing about "aliveness" is faked on the client.

---

## 8. Routing

`lib/router.tsx` — history API, typed `Route` union, and a per-route `DEPTH` so transitions know
whether they're a push or a pop.

| URL | Screen |
|---|---|
| `/` | Rooms (home) |
| `/welcome` | Onboarding |
| `/r/:code` | Room — Live / Moments / Chat |
| `/r/:code/members` | Members / Activity / Media |
| `/r/:code/invite` | Invite |
| `/join/:code` | Invite-link landing |
| `/create` | Create a room |
| `/camera` · `/camera/:code` | Camera → Post preview |
| `/me` · `/settings` | Profile · Settings |

The bottom navigation stays visible inside a room, and hides for the camera, the media viewer and
the live voice room.

---

## 9. Degradation

- **Dropped connection.** Only the very first connect gets a full-screen loader. After that a drop
  is a small "Reconnecting…" strip over the room you were already looking at; the subscription
  re-applies on its own and the UI catches up.
- **No microphone.** The voice room says so plainly and you stay in as a listener; the composer's
  mic explains itself instead of failing silently.
- **No camera.** The camera screen offers the gallery instead.
- **No WebGL / reduced motion.** The ambient layer never loads; a CSS gradient stands in.
- **Blocked storage.** Every `localStorage` read and write is wrapped; preferences degrade to
  defaults rather than throwing.

---

## 10. Performance

- Three.js is a **lazy chunk** — 172KB gzip on the critical path, 221KB deferred and only fetched
  when WebGL and motion are both available.
- `MomentCard`, `ChatRow`, `RoomCard`, `ActivityRow`, `Avatar` and `Waveform` are memoised; the
  derivation layer keeps object identities stable across unrelated updates.
- The WebGL loop and the shared clock both stop on `visibilitychange`.
- Waveforms are computed once at record time and stored as a 48-character string.

---

## 11. Verifying it

```bash
spacetime start                                   # local server
spacetime publish chai-time-r7mf4 -p ./spacetimedb -s local -y
cd client && npm install && npm run dev           # http://localhost:5173
npm run e2e                                       # two clients, real pushes
npx tsc -b && npm run build                       # types + production build
```

`npm run e2e` opens two independent connections and asserts the whole real-time contract — room
creation, joining, presence, moments, media references, reaction toggling, quoted replies, chat,
voice notes, voice sessions, WebRTC signalling, mute state, and an empty voice room closing itself.
Every assertion waits for a push; nothing sleeps and nothing refetches.
