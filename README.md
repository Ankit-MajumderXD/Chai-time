# 🫖 Chai Time

**Real moments. Better together.**

A private, real-time social app for your people — family, friends, a trip, a class, one night out.
Make a room, drop the link in your group chat, and see what everyone is doing *right now*.

No followers. No public likes. No algorithm. No endless scroll.
Just **people → rooms → presence → moments → camera**.

Built on [SpacetimeDB](https://spacetimedb.com): the database *is* the server, and every screen is
a live projection of it. Presence, moments, reactions and replies all arrive by push — there is no
polling anywhere in the client.

---

## Run it

```bash
# 1. Start SpacetimeDB locally
spacetime start

# 2. Publish the module
spacetime publish chai-time-r7mf4 --module-path ./spacetimedb --server local --yes

# 3. Generate client bindings (only needed after a schema change)
cd client
npx spacetime generate --lang typescript --out-dir src/module_bindings --module-path ../spacetimedb -y

# 4. Run the app
npm install
npm run dev          # http://localhost:5173
```

Open it, pick a name and a face, and you land in three rooms full of people. Open a second browser
profile, paste an invite link, and watch both windows update each other.

### Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run e2e` | Two clients, asserts the real-time contract end to end |
| `npm run spacetime:publish:local` | Republish the module to the local server |
| `npm run spacetime:generate` | Regenerate TypeScript bindings |

---

## What's in it

| Screen | |
|---|---|
| **Onboarding** | Layered photographs in a tilting 3D space, a WebGL pastel wash, and a two-field sign-up (there's no password — your SpacetimeDB identity *is* the account) |
| **Rooms** | Your greeting, a one-tap "what are you up to", your people as live faces, and big photographic room cards |
| **Room** | Three tabs. **Live** — big faces, presence rings, what everyone's up to, and the voice room. **Moments** — photos, clips, voice notes and text with reactions. **Chat** — the conversation, including replies that quote a moment |
| **Live voice** | Drop-in voice for the room: big faces, a ring that lights when you speak, mute / speaker / leave / invite. WebRTC peer-to-peer, signalled through SpacetimeDB |
| **Composer** | Camera · text · attachments · mic. Hold the mic to record a voice note, slide left to cancel |
| **Camera** | Full-screen preview, photo/video, front/back, gallery, big shutter |
| **Post preview** | Full-bleed shot, caption, stickers, pick a room, one big Post button |
| **Members** | Members / Activity / Media — presence in detail, with the gallery filtered by All / Photos / Videos / Voice |
| **Create room** | Name it, pick a vibe (the screen repaints as you choose), it's private by default |
| **Invite** | Share link, readable room code, QR, contacts |
| **Profile & Settings** | Your face, your numbers, your photos, and privacy in plain language |

Room owners also get settings: rename, change the vibe and cover, turn on event mode, manage
members, delete the room.

---

## Docs

- **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** — colour, type, space, elevation, motion, moods, voice
- **[UI_ARCHITECTURE.md](./UI_ARCHITECTURE.md)** — data model, subscriptions, derivation layer,
  routing, media, performance

---

## Stack

React 18 · Vite 7 · TypeScript · Framer Motion · Three.js (`@react-three/fiber`) · WebRTC ·
SpacetimeDB 2.10 (TypeScript module) · plain CSS with a centralised token system.

**Media** never goes into a database row: `client/src/lib/upload.ts` produces a reference (url +
type + dimensions/duration/waveform) and the reducers store only that. Point
`VITE_MEDIA_UPLOAD_URL` at a presigning endpoint and it uploads to R2/S3 instead of falling back to
a data URL — no other change.

**Voice** never goes into a database row either: SpacetimeDB owns the session, the roster, mute
flags and voice-activity timestamps, plus a short-lived `signal` table used purely to exchange
WebRTC offers and ICE candidates. The audio flows peer to peer.
