/**
 * Chai Time — module entry.
 *
 * Tables come from ./tables; the scheduled tables live here so each sits beside
 * the reducer it fires. Everything below is transactional and deterministic:
 * time and randomness come from `ctx`, never from the host.
 *
 * ── MEDIA STORAGE ──────────────────────────────────────────────────────────
 * Bytes never live in a row. `postMoment` / `sendMessage` take a *reference*
 * (url + type + dimensions/duration/waveform) and write a `media` row, exactly
 * the shape an object store hands back. In production the client presigns an
 * upload to R2/S3 and passes the resulting URL; in local dev it passes a data
 * URL instead. Either way the schema, the reducers and the UI are unchanged —
 * see client/src/lib/upload.ts.
 *
 * ── VOICE ──────────────────────────────────────────────────────────────────
 * Audio never touches the database. SpacetimeDB owns session state, the
 * participant list, mute flags and voice-activity timestamps, plus a `signal`
 * table used purely as a WebRTC signalling channel (offers/answers/ICE, deleted
 * the moment they are consumed). The media itself flows peer-to-peer.
 */
import { schema, table, t, SenderError } from 'spacetimedb/server';
import { ScheduleAt, Timestamp } from 'spacetimedb';
import {
  person,
  room,
  room_member,
  media,
  moment,
  message,
  reaction,
  room_event,
  badge,
  roast,
  roast_vote,
  room_prompt_schedule,
  prompt_library,
  custom_prompt,
  room_prompt,
  roast_line_library,
  roast_reaction,
  room_title,
  voice_session,
  voice_participant,
  signal,
} from './tables';

const TYPING_WINDOW_MICROS = 5_000_000n; // typing lives 5s past the last keystroke
const SPEAKING_WINDOW_MICROS = 1_600_000n; // a voice-activity ping lasts 1.6s
const SIGNAL_TTL_MICROS = 45_000_000n; // unconsumed signalling is junk after 45s
const DEMO_TICK_MICROS = 9_000_000n;
const SWEEP_MICROS = 20_000_000n;

/* ------------------------------------------------------------- Schedules -- */

const demo_tick_timer = table(
  { name: 'demo_tick_timer', scheduled: (): any => demoTick },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
  }
);

const sweep_timer = table(
  { name: 'sweep_timer', scheduled: (): any => sweep },
  {
    scheduled_id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
  }
);

const spacetimedb = schema({
  person,
  room,
  room_member,
  media,
  moment,
  message,
  reaction,
  room_event,
  badge,
  roast,
  roast_vote,
  room_prompt_schedule,
  prompt_library,
  custom_prompt,
  room_prompt,
  roast_line_library,
  roast_reaction,
  voice_session,
  voice_participant,
  signal,
  room_title,
  demo_tick_timer,
  sweep_timer,
});
export default spacetimedb;

/* --------------------------------------------------------------- Helpers -- */

function requirePerson(ctx: any) {
  const p = ctx.db.person.identity.find(ctx.sender);
  if (!p) throw new SenderError('Set up your profile first');
  return p;
}

function memberIn(ctx: any, roomId: bigint, personId: bigint) {
  return [...ctx.db.room_member.by_room_person.filter([roomId, personId])][0];
}

function requireMembership(ctx: any, roomId: bigint) {
  const p = requirePerson(ctx);
  const m = memberIn(ctx, roomId, p.id);
  if (!m) throw new SenderError('Join this room first');
  return { person: p, member: m };
}

function requireOwner(ctx: any, roomId: bigint) {
  const p = requirePerson(ctx);
  const r = ctx.db.room.id.find(roomId);
  if (!r) throw new SenderError('That room is gone');
  if (r.ownerId !== p.id) throw new SenderError('Only the room owner can do that');
  return { person: p, room: r };
}

function touchRoom(ctx: any, roomId: bigint) {
  const r = ctx.db.room.id.find(roomId);
  if (r) ctx.db.room.id.update({ ...r, lastActivityAt: ctx.timestamp });
}

function logEvent(ctx: any, roomId: bigint, kind: string, memberId: bigint, text: string) {
  ctx.db.room_event.insert({
    id: 0n,
    roomId,
    kind,
    memberId,
    text,
    createdAt: ctx.timestamp,
  });
}

/** Same, but at an explicit past time — used to script the demo timeline so
 *  "Replay the room" has something to show on the very first press. */
function logEventAt(
  ctx: any,
  roomId: bigint,
  kind: string,
  memberId: bigint,
  text: string,
  at: any
) {
  ctx.db.room_event.insert({ id: 0n, roomId, kind, memberId, text, createdAt: at });
}

/**
 * Record a "came online" beat for the replay — but only on a real
 * offline→online edge, and not if the member was already seen in the last
 * couple of minutes, so a flaky socket doesn't spam the timeline.
 */
const ONLINE_EVENT_GAP_MICROS = 120_000_000n;
function logCameOnline(ctx: any, member: any) {
  if (member.status === 'online') return;
  if (
    ctx.timestamp.microsSinceUnixEpoch - member.lastSeenAt.microsSinceUnixEpoch <
    ONLINE_EVENT_GAP_MICROS
  ) {
    return;
  }
  logEvent(ctx, member.roomId, 'online', member.id, `${member.displayName} came online`);
}

/** Writes the media reference row and hands back its id (0 when there is none). */
function attachMedia(
  ctx: any,
  roomId: bigint,
  memberId: bigint,
  args: {
    kind: string;
    url: string;
    mimeType: string;
    width: number;
    height: number;
    durationMs: number;
    sizeBytes: number;
    waveform: string;
    posterUrl?: string;
  }
): bigint {
  if (!args.url) return 0n;
  const row = ctx.db.media.insert({
    id: 0n,
    roomId,
    memberId,
    kind: args.kind,
    url: args.url,
    posterUrl: args.posterUrl ?? '',
    mimeType: args.mimeType,
    width: args.width,
    height: args.height,
    durationMs: args.durationMs,
    sizeBytes: args.sizeBytes,
    waveform: args.waveform.slice(0, 128),
    createdAt: ctx.timestamp,
  });
  return row.id;
}

function dropMedia(ctx: any, mediaId: bigint) {
  if (mediaId === 0n) return;
  ctx.db.media.id.delete(mediaId);
}

/* ------------------------------------------------------ Streaks & badges -- */

const DAY_MICROS = 86_400_000_000n;

/** Whole UTC days since the epoch — a deterministic stand-in for "the date". */
function dayOrdinal(ts: any): number {
  return Number(ts.microsSinceUnixEpoch / DAY_MICROS);
}

/** First microsecond of a given day ordinal. */
function dayStartMicros(ordinal: number): bigint {
  return BigInt(ordinal) * DAY_MICROS;
}

/**
 * Mint a badge if this membership doesn't already hold one of that type awarded
 * at or after `sinceMicros`. Streak badges pass `0n` (once, ever); the daily
 * awards pass the start of today (once per day). Returns true if a row was
 * actually inserted, so the caller can log the unlock.
 */
function awardBadge(
  ctx: any,
  membershipId: bigint,
  badgeType: string,
  sinceMicros: bigint = 0n
): boolean {
  const held = [...ctx.db.badge.by_member_type.filter([membershipId, badgeType])].some(
    (b: any) => b.awardedAt.microsSinceUnixEpoch >= sinceMicros
  );
  if (held) return false;
  ctx.db.badge.insert({
    id: 0n,
    membershipId,
    badgeType,
    awardedAt: ctx.timestamp,
  });
  return true;
}

/**
 * Roll this membership's posting streak forward for a moment posted now, and
 * mint any streak badge it just crossed. Called from `postMoment`.
 */
function bumpStreak(ctx: any, memberId: bigint) {
  const m = ctx.db.room_member.id.find(memberId);
  if (!m) return;
  const today = dayOrdinal(ctx.timestamp);

  let current = m.currentStreak;
  if (m.lastMomentDate === today) {
    // already counted a moment today — nothing changes
  } else if (m.lastMomentDate === today - 1) {
    current = m.currentStreak + 1;
  } else {
    current = 1;
  }

  const longest = Math.max(m.longestStreak, current);
  ctx.db.room_member.id.update({
    ...m,
    currentStreak: current,
    longestStreak: longest,
    lastMomentDate: today,
  });

  if (current >= 7) awardBadge(ctx, memberId, '7_day_streak');
  if (current >= 30) awardBadge(ctx, memberId, '30_day_streak');
}

/* ------------------------------------------------- Prompts & roast lines -- */

const PROMPT_LIBRARY: Array<{ roomType: string; text: string }> = [
  { roomType: 'family', text: 'Ghar pe abhi sabse zyada shor kaun macha raha hai?' },
  { roomType: 'family', text: 'Aaj ka khaana dikhao na!' },
  { roomType: 'family', text: 'Chai ka time — ek photo bhejo jaise ho waise' },
  { roomType: 'family', text: 'Abhi ghar mein sabse busy kaun hai?' },
  { roomType: 'family', text: 'Weekend ka plan kya chal raha hai ghar pe?' },
  { roomType: 'friends', text: 'Abhi kya scene hai bro?' },
  { roomType: 'friends', text: 'Sabse zyada bore kaun ho raha hai rn?' },
  { roomType: 'friends', text: 'Ek selfie daalo, jaise ho waise, no pose' },
  { roomType: 'friends', text: 'Kaun sabse zyada natak kar raha hai abhi?' },
  { roomType: 'friends', text: 'Kya khichdi pak rahi hai abhi?' },
];

const ROAST_LINE_LIBRARY: Array<{
  category: string;
  heatLevel: string;
  style: string;
  text: string;
}> = [
  // 🔥 fire — the original set
  { style: 'fire', category: 'flex', heatLevel: 'mild', text: "Bro thinks he's the main character rn" },
  { style: 'fire', category: 'lazy', heatLevel: 'mild', text: 'Full power-saving mode on today' },
  { style: 'fire', category: 'chaos', heatLevel: 'mild', text: 'Yeh vibe kahan se aayi bhai' },
  { style: 'fire', category: 'flex', heatLevel: 'spicy', text: 'Bhai gym select kar liya ya sirf mirror mein dekh ke aaya?' },
  { style: 'fire', category: 'awkward', heatLevel: 'spicy', text: 'Itna filter laga hai, camera bhi confuse ho gaya' },
  { style: 'fire', category: 'awkward', heatLevel: 'spicy', text: 'Pose dete waqt kya soch raha tha bhai 😭' },
  { style: 'fire', category: 'dramatic', heatLevel: 'spicy', text: 'Yeh scene toh seedha KJo ki movie se hai' },
  { style: 'fire', category: 'flex', heatLevel: 'savage', text: 'CEO of confidence for no reason 💀' },
  { style: 'fire', category: 'dramatic', heatLevel: 'savage', text: 'Bahubali ka trailer chal raha hai kya' },
  { style: 'fire', category: 'dramatic', heatLevel: 'savage', text: "Camera: 'main kya dekh raha hoon abhi'" },
  { style: 'fire', category: 'flex', heatLevel: 'savage', text: 'Full paisa vasool expression hai yeh' },

  // 😈 devil — scheming, "you're up to something"
  { style: 'devil', category: 'chaos', heatLevel: 'mild', text: 'Planning kuch bada, aankhon se dikh raha hai' },
  { style: 'devil', category: 'flex', heatLevel: 'mild', text: 'Innocent face, guilty energy' },
  { style: 'devil', category: 'chaos', heatLevel: 'spicy', text: 'Yeh smile ke peeche poora blueprint hai' },
  { style: 'devil', category: 'dramatic', heatLevel: 'spicy', text: 'Villain origin story ka episode 1' },
  { style: 'devil', category: 'flex', heatLevel: 'savage', text: 'Certified menace, group chat ka danger' },
  { style: 'devil', category: 'chaos', heatLevel: 'savage', text: 'HR ko iski file alag rakhni chahiye' },

  // 💀 skull — "I'm deceased", brutal-final
  { style: 'skull', category: 'awkward', heatLevel: 'mild', text: 'Isko dekh ke thoda sa mar gaya main' },
  { style: 'skull', category: 'dramatic', heatLevel: 'mild', text: 'RIP to whoever approved this pose' },
  { style: 'skull', category: 'awkward', heatLevel: 'spicy', text: 'Yeh photo dekh ke retina ne resign kar diya' },
  { style: 'skull', category: 'flex', heatLevel: 'spicy', text: 'Confidence itna ki mirror crack ho gaya' },
  { style: 'skull', category: 'dramatic', heatLevel: 'savage', text: 'No survivors. Frame ke andar bhi nahi' },
  { style: 'skull', category: 'flex', heatLevel: 'savage', text: 'Buried. Six feet under this caption' },

  // 🤡 clown — you played yourself
  { style: 'clown', category: 'awkward', heatLevel: 'mild', text: 'Circus ka call aaya tha, tu utha nahi' },
  { style: 'clown', category: 'chaos', heatLevel: 'mild', text: 'Honk honk, warm-up act shuru' },
  { style: 'clown', category: 'flex', heatLevel: 'spicy', text: 'Main event bina makeup ke pohanch gaya' },
  { style: 'clown', category: 'awkward', heatLevel: 'spicy', text: 'Yeh pose khud pe prank tha kya' },
  { style: 'clown', category: 'dramatic', heatLevel: 'savage', text: 'You played yourself — grand finale performance' },
  { style: 'clown', category: 'chaos', heatLevel: 'savage', text: 'Poori parade akela leke aa gaya' },
];

const ROAST_STYLES = ['fire', 'devil', 'skull', 'clown'];

/** Seed the read-only libraries once. Idempotent — safe to call from `init`
 * and from any reducer that needs them present (they miss `init` on a
 * hot-swapped schema). */
function ensureContentSeeded(ctx: any) {
  if ([...ctx.db.prompt_library.iter()].length === 0) {
    for (const row of PROMPT_LIBRARY) {
      ctx.db.prompt_library.insert({ id: 0n, roomType: row.roomType, text: row.text });
    }
  }
  // Per-style so a hot-swap that adds a new style (devil / skull / clown) to an
  // already-seeded library fills in just the missing styles.
  const existingLines = [...ctx.db.roast_line_library.iter()];
  for (const style of ROAST_STYLES) {
    if (existingLines.some((l: any) => l.style === style)) continue;
    for (const row of ROAST_LINE_LIBRARY.filter((r) => r.style === style)) {
      ctx.db.roast_line_library.insert({
        id: 0n,
        category: row.category,
        heatLevel: row.heatLevel,
        style: row.style,
        text: row.text,
      });
    }
  }
}

const MINUTE_MICROS = 60_000_000n;

/** Minutes since UTC midnight for a timestamp (0–1439). */
function minutesOfDayUTC(ts: any): number {
  return Number((ts.microsSinceUnixEpoch % DAY_MICROS) / MINUTE_MICROS);
}

/** "H:MM" / "HH:MM" → minutes since midnight, or -1 if unparseable. */
function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return -1;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return -1;
  return h * 60 + min;
}

/** Replace a room's live prompt and announce it. */
function firePrompt(ctx: any, roomId: bigint, text: string, source: string) {
  const body = text.trim().slice(0, 200);
  if (!body) return;
  const existing = ctx.db.room_prompt.roomId.find(roomId);
  if (existing) ctx.db.room_prompt.id.delete(existing.id);
  ctx.db.room_prompt.insert({
    id: 0n,
    roomId,
    text: body,
    source,
    startedAt: ctx.timestamp,
  });
  logEvent(ctx, roomId, 'prompt', 0n, body);
  touchRoom(ctx, roomId);
}

function scheduledPromptText(ctx: any, room: any, sched: any): string {
  if (sched.source === 'custom') {
    const active = [...ctx.db.custom_prompt.roomId.filter(room.id)].find((c: any) => c.active);
    return active ? active.text : '';
  }
  const type = sched.source === 'default_friends' ? 'friends' : 'family';
  const pool = [...ctx.db.prompt_library.roomType.filter(type)];
  if (pool.length === 0) return '';
  return pool[ctx.random.integerInRange(0, pool.length - 1)].text;
}

/* ------------------------------------------------------------- Lifecycle -- */

export const init = spacetimedb.init((ctx) => {
  ctx.db.demo_tick_timer.insert({
    scheduled_id: 0n,
    scheduled_at: ScheduleAt.interval(DEMO_TICK_MICROS),
  });
  ctx.db.sweep_timer.insert({
    scheduled_id: 0n,
    scheduled_at: ScheduleAt.interval(SWEEP_MICROS),
  });
  ensureContentSeeded(ctx);
});

/** A short, greppable connection-event line for `spacetime logs`. */
function logConn(ctx: any, event: string, extra: Record<string, unknown> = {}) {
  const parts = [
    `identity=${ctx.sender.toHexString().slice(0, 12)}`,
    `connection=${ctx.connectionId ? ctx.connectionId.toHexString().slice(0, 12) : 'none'}`,
    ...Object.entries(extra).map(([k, v]) => `${k}=${v}`),
  ];
  console.info(`[conn] ${event} ${parts.join(' ')}`);
}

export const onConnect = spacetimedb.clientConnected((ctx) => {
  const p = ctx.db.person.identity.find(ctx.sender);
  const members = p ? [...ctx.db.room_member.personId.filter(p.id)] : [];
  logConn(ctx, 'connected', {
    known: p ? 'yes' : 'no',
    person: p ? p.id : 0,
    rooms: members.length,
  });
  for (const m of members) {
    logCameOnline(ctx, m);
    ctx.db.room_member.id.update({ ...m, status: 'online', lastSeenAt: ctx.timestamp });
  }
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  const p = ctx.db.person.identity.find(ctx.sender);
  if (!p) {
    logConn(ctx, 'disconnected', { known: 'no' });
    return;
  }

  const droppedVoice = [...ctx.db.voice_participant.personId.filter(p.id)];
  const members = [...ctx.db.room_member.personId.filter(p.id)];
  logConn(ctx, 'disconnected', {
    known: 'yes',
    person: p.id,
    rooms: members.length,
    leftVoice: droppedVoice.length,
  });

  // Drop out of any live voice room — a ghost in a voice call is worse than a
  // ghost in a member list.
  for (const vp of droppedVoice) {
    ctx.db.voice_participant.id.delete(vp.id);
  }
  for (const m of members) {
    ctx.db.room_member.id.update({
      ...m,
      status: 'offline',
      viewing: false,
      lastSeenAt: ctx.timestamp,
    });
  }
});

/* --------------------------------------------------------------- Profile -- */

export const saveProfile = spacetimedb.reducer(
  {
    displayName: t.string(),
    handle: t.string(),
    avatarUrl: t.string(),
    bio: t.string(),
  },
  (ctx, { displayName, handle, avatarUrl, bio }) => {
    const name = displayName.trim().slice(0, 40);
    if (!name) throw new SenderError('Tell us your name');

    const existing = ctx.db.person.identity.find(ctx.sender);
    if (existing) {
      ctx.db.person.id.update({
        ...existing,
        displayName: name,
        handle: handle.trim().slice(0, 24),
        avatarUrl,
        bio: bio.slice(0, 140),
      });
      for (const m of [...ctx.db.room_member.personId.filter(existing.id)]) {
        ctx.db.room_member.id.update({ ...m, displayName: name, avatarUrl });
      }
      return;
    }

    ctx.db.person.insert({
      id: 0n,
      identity: ctx.sender,
      handle: handle.trim().slice(0, 24),
      displayName: name,
      avatarUrl,
      bio: bio.slice(0, 140),
      createdAt: ctx.timestamp,
    });
  }
);

/* ----------------------------------------------------------------- Rooms -- */

function addMember(ctx: any, roomId: bigint, p: any) {
  return ctx.db.room_member.insert({
    id: 0n,
    roomId,
    personId: p.id,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    status: 'online',
    activity: '',
    activityEmoji: '',
    isDemo: false,
    viewing: false,
    typingUntil: ctx.timestamp,
    joinedAt: ctx.timestamp,
    lastSeenAt: ctx.timestamp,
    currentStreak: 0,
    longestStreak: 0,
    lastMomentDate: 0,
    lastReplayMicros: 0n,
  });
}

export const createRoom = spacetimedb.reducer(
  {
    code: t.string(),
    name: t.string(),
    emoji: t.string(),
    kind: t.string(),
    coverUrl: t.string(),
    isEvent: t.bool(),
  },
  (ctx, { code, name, emoji, kind, coverUrl, isEvent }) => {
    const me = requirePerson(ctx);
    if (ctx.db.room.code.find(code)) {
      throw new SenderError('That code is taken — try again');
    }
    const created = ctx.db.room.insert({
      id: 0n,
      code,
      name: name.trim().slice(0, 40) || 'New room',
      emoji,
      kind,
      coverUrl,
      isEvent,
      ownerId: me.id,
      createdAt: ctx.timestamp,
      lastActivityAt: ctx.timestamp,
      roastMode: false,
    });
    const member = addMember(ctx, created.id, me);
    logEvent(ctx, created.id, 'created', member.id, `${me.displayName} started this room`);
  }
);

export const joinRoom = spacetimedb.reducer({ code: t.string() }, (ctx, { code }) => {
  const me = requirePerson(ctx);
  const target = ctx.db.room.code.find(code.trim().toUpperCase());
  if (!target) throw new SenderError("We couldn't find that room");

  const already = memberIn(ctx, target.id, me.id);
  if (already) {
    ctx.db.room_member.id.update({ ...already, status: 'online', lastSeenAt: ctx.timestamp });
    return;
  }
  const member = addMember(ctx, target.id, me);
  logEvent(ctx, target.id, 'joined', member.id, `${me.displayName} joined the room`);
  touchRoom(ctx, target.id);
});

export const leaveRoom = spacetimedb.reducer({ roomId: t.u64() }, (ctx, { roomId }) => {
  const { member } = requireMembership(ctx, roomId);
  for (const vp of [...ctx.db.voice_participant.memberId.filter(member.id)]) {
    ctx.db.voice_participant.id.delete(vp.id);
  }
  logEvent(ctx, roomId, 'left', member.id, `${member.displayName} left`);
  ctx.db.room_member.id.delete(member.id);
});

export const updateRoom = spacetimedb.reducer(
  {
    roomId: t.u64(),
    name: t.string(),
    emoji: t.string(),
    kind: t.string(),
    coverUrl: t.string(),
    isEvent: t.bool(),
  },
  (ctx, { roomId, name, emoji, kind, coverUrl, isEvent }) => {
    const { room: current } = requireOwner(ctx, roomId);
    ctx.db.room.id.update({
      ...current,
      name: name.trim().slice(0, 40) || current.name,
      emoji: emoji || current.emoji,
      kind: kind || current.kind,
      coverUrl: coverUrl || current.coverUrl,
      isEvent,
    });
  }
);

export const removeMember = spacetimedb.reducer(
  { memberId: t.u64() },
  (ctx, { memberId }) => {
    const target = ctx.db.room_member.id.find(memberId);
    if (!target) return;
    const { person: me } = requireOwner(ctx, target.roomId);
    if (target.personId === me.id) throw new SenderError("You can't remove yourself");
    for (const vp of [...ctx.db.voice_participant.memberId.filter(memberId)]) {
      ctx.db.voice_participant.id.delete(vp.id);
    }
    ctx.db.room_member.id.delete(memberId);
    logEvent(ctx, target.roomId, 'left', memberId, `${target.displayName} was removed`);
  }
);

export const deleteRoom = spacetimedb.reducer({ roomId: t.u64() }, (ctx, { roomId }) => {
  requireOwner(ctx, roomId);

  for (const m of [...ctx.db.moment.roomId.filter(roomId)]) {
    for (const r of [...ctx.db.reaction.momentId.filter(m.id)]) ctx.db.reaction.id.delete(r.id);
    for (const rr of [...ctx.db.roast_reaction.momentId.filter(m.id)]) {
      ctx.db.roast_reaction.id.delete(rr.id);
    }
    ctx.db.moment.id.delete(m.id);
  }
  for (const sched of [...ctx.db.room_prompt_schedule.roomId.filter(roomId)]) {
    ctx.db.room_prompt_schedule.id.delete(sched.id);
  }
  for (const cp of [...ctx.db.custom_prompt.roomId.filter(roomId)]) {
    ctx.db.custom_prompt.id.delete(cp.id);
  }
  { const lp = ctx.db.room_prompt.roomId.find(roomId); if (lp) ctx.db.room_prompt.id.delete(lp.id); }
  for (const roastRow of [...ctx.db.roast.roomId.filter(roomId)]) {
    for (const v of [...ctx.db.roast_vote.roastId.filter(roastRow.id)]) {
      ctx.db.roast_vote.id.delete(v.id);
    }
    ctx.db.roast.id.delete(roastRow.id);
  }
  for (const mem of [...ctx.db.room_member.roomId.filter(roomId)]) {
    for (const b of [...ctx.db.badge.by_member_type.filter(mem.id)]) ctx.db.badge.id.delete(b.id);
  }
  for (const msg of [...ctx.db.message.roomId.filter(roomId)]) ctx.db.message.id.delete(msg.id);
  for (const md of [...ctx.db.media.roomId.filter(roomId)]) ctx.db.media.id.delete(md.id);
  for (const e of [...ctx.db.room_event.roomId.filter(roomId)]) ctx.db.room_event.id.delete(e.id);
  for (const rt of [...ctx.db.room_title.roomId.filter(roomId)]) ctx.db.room_title.id.delete(rt.id);
  for (const vp of [...ctx.db.voice_participant.roomId.filter(roomId)]) {
    ctx.db.voice_participant.id.delete(vp.id);
  }
  const session = ctx.db.voice_session.roomId.find(roomId);
  if (session) ctx.db.voice_session.id.delete(session.id);
  for (const m of [...ctx.db.room_member.roomId.filter(roomId)]) {
    ctx.db.room_member.id.delete(m.id);
  }
  ctx.db.room.id.delete(roomId);
});

/* -------------------------------------------------------------- Presence -- */

export const setActivity = spacetimedb.reducer(
  { activity: t.string(), activityEmoji: t.string(), status: t.string() },
  (ctx, { activity, activityEmoji, status }) => {
    const me = requirePerson(ctx);
    for (const m of [...ctx.db.room_member.personId.filter(me.id)]) {
      ctx.db.room_member.id.update({
        ...m,
        activity: activity.slice(0, 48),
        activityEmoji: activityEmoji.slice(0, 8),
        status: status || 'online',
        lastSeenAt: ctx.timestamp,
      });
    }
  }
);

export const setViewing = spacetimedb.reducer(
  { roomId: t.u64(), viewing: t.bool() },
  (ctx, { roomId, viewing }) => {
    const me = requirePerson(ctx);
    for (const m of [...ctx.db.room_member.personId.filter(me.id)]) {
      const isTarget = m.roomId === roomId;
      const next = isTarget ? viewing : false;
      if (m.viewing === next && !isTarget) continue;
      ctx.db.room_member.id.update({
        ...m,
        viewing: next,
        status: 'online',
        lastSeenAt: ctx.timestamp,
      });
    }
  }
);

export const setTyping = spacetimedb.reducer({ roomId: t.u64() }, (ctx, { roomId }) => {
  const { member } = requireMembership(ctx, roomId);
  ctx.db.room_member.id.update({
    ...member,
    typingUntil: new Timestamp(ctx.timestamp.microsSinceUnixEpoch + TYPING_WINDOW_MICROS),
    lastSeenAt: ctx.timestamp,
  });
});

/**
 * "Replay the room" watermark: after a member watches the replay, everything up
 * to now stops counting as unseen. The client reads `lastReplayMicros` off its
 * own membership row to know where a replay should begin.
 */
export const markRoomCaughtUp = spacetimedb.reducer(
  { roomId: t.u64() },
  (ctx, { roomId }) => {
    const { member } = requireMembership(ctx, roomId);
    ctx.db.room_member.id.update({
      ...member,
      lastReplayMicros: ctx.timestamp.microsSinceUnixEpoch,
      lastSeenAt: ctx.timestamp,
    });
  }
);

/* --------------------------------------------------------------- Moments -- */

export const postMoment = spacetimedb.reducer(
  {
    roomId: t.u64(),
    kind: t.string(),
    caption: t.string(),
    mediaUrl: t.string(),
    posterUrl: t.string(),
    mimeType: t.string(),
    width: t.u32(),
    height: t.u32(),
    durationMs: t.u32(),
    sizeBytes: t.u32(),
    waveform: t.string(),
  },
  (ctx, args) => {
    const { member } = requireMembership(ctx, args.roomId);
    const mediaId = attachMedia(ctx, args.roomId, member.id, {
      kind: args.kind === 'text' ? 'photo' : args.kind,
      url: args.mediaUrl,
      posterUrl: args.posterUrl,
      mimeType: args.mimeType,
      width: args.width,
      height: args.height,
      durationMs: args.durationMs,
      sizeBytes: args.sizeBytes,
      waveform: args.waveform,
    });

    ctx.db.moment.insert({
      id: 0n,
      roomId: args.roomId,
      memberId: member.id,
      kind: args.kind,
      mediaId,
      caption: args.caption.slice(0, 220),
      createdAt: ctx.timestamp,
    });
    // Streak + any streak badge it just crossed.
    bumpStreak(ctx, member.id);
    logEvent(ctx, args.roomId, 'posted', member.id, `${member.displayName} shared a moment`);
    touchRoom(ctx, args.roomId);
  }
);

export const deleteMoment = spacetimedb.reducer(
  { momentId: t.u64() },
  (ctx, { momentId }) => {
    const target = ctx.db.moment.id.find(momentId);
    if (!target) return;
    const { member } = requireMembership(ctx, target.roomId);
    if (target.memberId !== member.id) {
      throw new SenderError('You can only remove your own moments');
    }
    for (const r of [...ctx.db.reaction.momentId.filter(momentId)]) ctx.db.reaction.id.delete(r.id);
    for (const roastRow of [...ctx.db.roast.momentId.filter(momentId)]) {
      for (const v of [...ctx.db.roast_vote.roastId.filter(roastRow.id)]) {
        ctx.db.roast_vote.id.delete(v.id);
      }
      ctx.db.roast.id.delete(roastRow.id);
    }
    for (const rr of [...ctx.db.roast_reaction.momentId.filter(momentId)]) {
      ctx.db.roast_reaction.id.delete(rr.id);
    }
    dropMedia(ctx, target.mediaId);
    ctx.db.moment.id.delete(momentId);
  }
);

export const toggleReaction = spacetimedb.reducer(
  { momentId: t.u64(), emoji: t.string() },
  (ctx, { momentId, emoji }) => {
    const target = ctx.db.moment.id.find(momentId);
    if (!target) throw new SenderError('That moment is gone');
    const { member } = requireMembership(ctx, target.roomId);

    const existing = [...ctx.db.reaction.momentId.filter(momentId)].find(
      (r: any) => r.memberId === member.id && r.emoji === emoji
    );
    if (existing) {
      ctx.db.reaction.id.delete(existing.id);
      return;
    }
    ctx.db.reaction.insert({
      id: 0n,
      momentId,
      memberId: member.id,
      emoji,
      createdAt: ctx.timestamp,
    });
    touchRoom(ctx, target.roomId);
  }
);

/* ------------------------------------------------------------ Roast mode -- */
//
// Roast mode is a per-room switch (owner only). While it's on, anyone in the
// room can post a short roast aimed at a moment and upvote other people's; one
// vote per person per roast. The daily pass in `sweep` hands the author of the
// top-voted roast a `roast_champion` badge.

export const setRoastMode = spacetimedb.reducer(
  { roomId: t.u64(), enabled: t.bool() },
  (ctx, { roomId, enabled }) => {
    const { person: me, room: current } = requireOwner(ctx, roomId);
    if (current.roastMode === enabled) return;
    ctx.db.room.id.update({ ...current, roastMode: enabled });
    const owner = memberIn(ctx, roomId, me.id);
    logEvent(
      ctx,
      roomId,
      enabled ? 'roast_on' : 'roast_off',
      owner ? owner.id : 0n,
      enabled ? 'Roast mode is on 🔥' : 'Roast mode is off'
    );
    touchRoom(ctx, roomId);
  }
);

export const postRoast = spacetimedb.reducer(
  { momentId: t.u64(), text: t.string() },
  (ctx, { momentId, text }) => {
    const target = ctx.db.moment.id.find(momentId);
    if (!target) throw new SenderError('That moment is gone');
    const home = ctx.db.room.id.find(target.roomId);
    if (!home || !home.roastMode) throw new SenderError('Roast mode is off in this room');
    const { member } = requireMembership(ctx, target.roomId);

    const body = text.trim().slice(0, 240);
    if (!body) throw new SenderError('Write a roast first');

    ctx.db.roast.insert({
      id: 0n,
      roomId: target.roomId,
      momentId,
      authorMembershipId: member.id,
      text: body,
      createdAt: ctx.timestamp,
    });
    touchRoom(ctx, target.roomId);
  }
);

export const deleteRoast = spacetimedb.reducer({ roastId: t.u64() }, (ctx, { roastId }) => {
  const target = ctx.db.roast.id.find(roastId);
  if (!target) return;
  const { member } = requireMembership(ctx, target.roomId);
  if (target.authorMembershipId !== member.id) {
    const home = ctx.db.room.id.find(target.roomId);
    const me = requirePerson(ctx);
    if (!home || home.ownerId !== me.id) {
      throw new SenderError('You can only remove your own roast');
    }
  }
  for (const v of [...ctx.db.roast_vote.roastId.filter(roastId)]) ctx.db.roast_vote.id.delete(v.id);
  ctx.db.roast.id.delete(roastId);
});

export const voteRoast = spacetimedb.reducer({ roastId: t.u64() }, (ctx, { roastId }) => {
  const target = ctx.db.roast.id.find(roastId);
  if (!target) throw new SenderError('That roast is gone');
  const { member } = requireMembership(ctx, target.roomId);

  const already = [...ctx.db.roast_vote.by_roast_member.filter([roastId, member.id])];
  if (already.length > 0) throw new SenderError('You already voted on this roast');

  ctx.db.roast_vote.insert({
    id: 0n,
    roastId,
    membershipId: member.id,
    createdAt: ctx.timestamp,
  });
  touchRoom(ctx, target.roomId);
});

/** Lets someone take their vote back — the composer UI toggles with this. */
export const unvoteRoast = spacetimedb.reducer({ roastId: t.u64() }, (ctx, { roastId }) => {
  const target = ctx.db.roast.id.find(roastId);
  if (!target) return;
  const { member } = requireMembership(ctx, target.roomId);
  for (const v of [...ctx.db.roast_vote.by_roast_member.filter([roastId, member.id])]) {
    ctx.db.roast_vote.id.delete(v.id);
  }
});

/* -------------------------------------------------- Fire roast reactions -- */
//
// A tap-to-react roast on a moment: pick a library line (by heat) or type your
// own. One per person per moment — a re-send replaces the previous one.

export const sendRoastReaction = spacetimedb.reducer(
  {
    momentId: t.u64(),
    lineId: t.u64(),
    customText: t.string(),
    heatLevel: t.string(),
    style: t.string(),
  },
  (ctx, { momentId, lineId, customText, heatLevel, style }) => {
    const target = ctx.db.moment.id.find(momentId);
    if (!target) throw new SenderError('That moment is gone');
    const { member } = requireMembership(ctx, target.roomId);

    const heat = ['mild', 'spicy', 'savage'].includes(heatLevel) ? heatLevel : 'mild';
    let badge = ROAST_STYLES.includes(style) ? style : 'fire';

    let finalLineId = 0n;
    let finalText = '';
    if (lineId !== 0n) {
      const line = ctx.db.roast_line_library.id.find(lineId);
      if (!line) throw new SenderError('Unknown roast line');
      finalLineId = lineId;
      // A library line's own filing wins — the badge always matches the chip.
      if (ROAST_STYLES.includes(line.style)) badge = line.style;
    } else {
      finalText = customText.trim().slice(0, 160);
      if (!finalText) throw new SenderError('Write your roast first');
    }

    for (const existing of [
      ...ctx.db.roast_reaction.by_moment_member.filter([momentId, member.id]),
    ]) {
      ctx.db.roast_reaction.id.delete(existing.id);
    }

    ctx.db.roast_reaction.insert({
      id: 0n,
      momentId,
      membershipId: member.id,
      lineId: finalLineId,
      customText: finalText,
      heatLevel: heat,
      style: badge,
      createdAt: ctx.timestamp,
    });
    touchRoom(ctx, target.roomId);
  }
);

export const clearRoastReaction = spacetimedb.reducer(
  { momentId: t.u64() },
  (ctx, { momentId }) => {
    const target = ctx.db.moment.id.find(momentId);
    if (!target) return;
    const { member } = requireMembership(ctx, target.roomId);
    for (const r of [...ctx.db.roast_reaction.by_moment_member.filter([momentId, member.id])]) {
      ctx.db.roast_reaction.id.delete(r.id);
    }
  }
);

/* ----------------------------------------------------- Scheduled prompts -- */
//
// A room can schedule a daily prompt ("Aaj ka khaana dikhao na!"). The daily
// pass in `sweep` fires it once per day when its UTC time comes round, drawing
// from the seeded default pack for the room's type or from the room's own
// active custom prompt. The owner can also fire one on demand.

/**
 * Replace a room's whole prompt schedule with the given set of daily times. A
 * room can queue several — `sweep` fires each one independently, once per day.
 * Times that already exist keep their `lastFiredDate` so re-saving doesn't
 * re-fire what already went out today.
 */
export const setRoomPromptSchedule = spacetimedb.reducer(
  {
    roomId: t.u64(),
    times: t.array(t.string()),
    source: t.string(),
    isActive: t.bool(),
  },
  (ctx, { roomId, times, source, isActive }) => {
    requireOwner(ctx, roomId);
    ensureContentSeeded(ctx);

    const src = ['default_family', 'default_friends', 'custom'].includes(source)
      ? source
      : 'default_family';

    // Normalise + dedupe by minute-of-day.
    const wanted = new Map<number, string>();
    for (const raw of times) {
      const mins = parseHHMM(raw);
      if (mins < 0) throw new SenderError('Use HH:MM times');
      if (!wanted.has(mins)) wanted.set(mins, raw.trim());
    }
    if (wanted.size > 7) {
      throw new SenderError('A room can have at most 7 scheduled prompts a day — remove one first.');
    }

    const nowMins = minutesOfDayUTC(ctx.timestamp);
    const today = dayOrdinal(ctx.timestamp);
    const existing = [...ctx.db.room_prompt_schedule.roomId.filter(roomId)];
    const byMins = new Map<number, any>();
    for (const s of existing) byMins.set(parseHHMM(s.scheduledTime), s);

    // Drop slots that are no longer in the set.
    for (const s of existing) {
      if (!wanted.has(parseHHMM(s.scheduledTime))) {
        ctx.db.room_prompt_schedule.id.delete(s.id);
      }
    }

    // Add or update the wanted slots.
    for (const [mins, hhmm] of wanted) {
      const prior = byMins.get(mins);
      if (prior) {
        ctx.db.room_prompt_schedule.id.update({
          ...prior,
          scheduledTime: hhmm,
          source: src,
          isActive,
        });
      } else {
        // A brand-new slot whose time already passed today is marked fired, so
        // adding it doesn't instantly trigger a backlog prompt.
        ctx.db.room_prompt_schedule.insert({
          id: 0n,
          roomId,
          scheduledTime: hhmm,
          isActive,
          source: src,
          lastFiredDate: nowMins >= mins ? today : 0,
        });
      }
    }
  }
);

export const addCustomPrompt = spacetimedb.reducer(
  { roomId: t.u64(), text: t.string() },
  (ctx, { roomId, text }) => {
    const { person: me } = requireOwner(ctx, roomId);
    const body = text.trim().slice(0, 200);
    if (!body) throw new SenderError('Write a prompt first');
    const owner = memberIn(ctx, roomId, me.id);

    // Only one custom prompt is "active" (the one a custom schedule fires).
    for (const c of [...ctx.db.custom_prompt.roomId.filter(roomId)]) {
      if (c.active) ctx.db.custom_prompt.id.update({ ...c, active: false });
    }
    ctx.db.custom_prompt.insert({
      id: 0n,
      roomId,
      text: body,
      createdBy: owner ? owner.id : 0n,
      active: true,
      createdAt: ctx.timestamp,
    });
  }
);

export const triggerPromptCycle = spacetimedb.reducer(
  { roomId: t.u64(), text: t.string(), source: t.string() },
  (ctx, { roomId, text, source }) => {
    requireOwner(ctx, roomId);
    ensureContentSeeded(ctx);
    let body = text.trim();
    if (!body) {
      if (source === 'custom') {
        const active = [...ctx.db.custom_prompt.roomId.filter(roomId)].find((c: any) => c.active);
        if (active) body = active.text;
      }
      if (!body) {
        const room = ctx.db.room.id.find(roomId);
        // Honour an explicit default pack; otherwise fall back to the room's kind.
        const type =
          source === 'default_friends'
            ? 'friends'
            : source === 'default_family'
              ? 'family'
              : room && room.kind === 'friends'
                ? 'friends'
                : 'family';
        const pool = [...ctx.db.prompt_library.roomType.filter(type)];
        if (pool.length > 0) {
          body = pool[ctx.random.integerInRange(0, pool.length - 1)].text;
        }
      }
    }
    firePrompt(ctx, roomId, body, source || 'manual');
  }
);

export const dismissRoomPrompt = spacetimedb.reducer(
  { roomId: t.u64() },
  (ctx, { roomId }) => {
    requireMembership(ctx, roomId);
    const p = ctx.db.room_prompt.roomId.find(roomId);
    if (p) ctx.db.room_prompt.id.delete(p.id);
  }
);

/* ------------------------------------------------------------------ Chat -- */

export const sendMessage = spacetimedb.reducer(
  {
    roomId: t.u64(),
    kind: t.string(),
    text: t.string(),
    momentId: t.u64(),
    mediaUrl: t.string(),
    posterUrl: t.string(),
    mimeType: t.string(),
    width: t.u32(),
    height: t.u32(),
    durationMs: t.u32(),
    sizeBytes: t.u32(),
    waveform: t.string(),
  },
  (ctx, args) => {
    const { member } = requireMembership(ctx, args.roomId);
    const body = args.text.slice(0, 600);
    if (!body.trim() && !args.mediaUrl) return;

    const mediaId = attachMedia(ctx, args.roomId, member.id, {
      kind: args.kind === 'text' ? 'photo' : args.kind,
      url: args.mediaUrl,
      posterUrl: args.posterUrl,
      mimeType: args.mimeType,
      width: args.width,
      height: args.height,
      durationMs: args.durationMs,
      sizeBytes: args.sizeBytes,
      waveform: args.waveform,
    });

    ctx.db.message.insert({
      id: 0n,
      roomId: args.roomId,
      memberId: member.id,
      kind: args.kind,
      text: body,
      mediaId,
      momentId: args.momentId,
      createdAt: ctx.timestamp,
    });
    // Sending clears your own typing indicator immediately.
    ctx.db.room_member.id.update({ ...member, typingUntil: ctx.timestamp });
    touchRoom(ctx, args.roomId);
  }
);

export const deleteMessage = spacetimedb.reducer(
  { messageId: t.u64() },
  (ctx, { messageId }) => {
    const target = ctx.db.message.id.find(messageId);
    if (!target) return;
    const { member } = requireMembership(ctx, target.roomId);
    if (target.memberId !== member.id) {
      throw new SenderError('You can only remove your own messages');
    }
    dropMedia(ctx, target.mediaId);
    ctx.db.message.id.delete(messageId);
  }
);

/* ------------------------------------------------------------ Live voice -- */

function joinSession(ctx: any, sessionId: bigint, roomId: bigint, member: any, personId: bigint) {
  const existing = [...ctx.db.voice_participant.by_session_member.filter([sessionId, member.id])][0];
  if (existing) return existing;
  return ctx.db.voice_participant.insert({
    id: 0n,
    sessionId,
    roomId,
    memberId: member.id,
    personId,
    muted: false,
    speakingUntil: ctx.timestamp,
    joinedAt: ctx.timestamp,
  });
}

export const startVoice = spacetimedb.reducer({ roomId: t.u64() }, (ctx, { roomId }) => {
  const { member, person: me } = requireMembership(ctx, roomId);

  const existing = ctx.db.voice_session.roomId.find(roomId);
  if (existing) {
    joinSession(ctx, existing.id, roomId, member, me.id);
    return;
  }
  const session = ctx.db.voice_session.insert({
    id: 0n,
    roomId,
    startedBy: member.id,
    startedAt: ctx.timestamp,
  });
  joinSession(ctx, session.id, roomId, member, me.id);
  logEvent(ctx, roomId, 'voice_started', member.id, `${member.displayName} started a voice room`);
  touchRoom(ctx, roomId);
});

export const joinVoice = spacetimedb.reducer({ roomId: t.u64() }, (ctx, { roomId }) => {
  const { member, person: me } = requireMembership(ctx, roomId);
  const session = ctx.db.voice_session.roomId.find(roomId);
  if (!session) throw new SenderError('Nobody is on voice right now');
  joinSession(ctx, session.id, roomId, member, me.id);
});

export const leaveVoice = spacetimedb.reducer({ roomId: t.u64() }, (ctx, { roomId }) => {
  const { member } = requireMembership(ctx, roomId);
  const session = ctx.db.voice_session.roomId.find(roomId);
  if (!session) return;

  for (const vp of [...ctx.db.voice_participant.by_session_member.filter([session.id, member.id])]) {
    ctx.db.voice_participant.id.delete(vp.id);
  }
  // Tell the remaining peers to tear down their connection to me.
  for (const other of [...ctx.db.voice_participant.sessionId.filter(session.id)]) {
    ctx.db.signal.insert({
      id: 0n,
      sessionId: session.id,
      fromMemberId: member.id,
      toMemberId: other.memberId,
      kind: 'bye',
      payload: '',
      createdAt: ctx.timestamp,
    });
  }

  const left = [...ctx.db.voice_participant.sessionId.filter(session.id)];
  if (left.length === 0) {
    ctx.db.voice_session.id.delete(session.id);
    logEvent(ctx, roomId, 'voice_ended', member.id, 'The voice room ended');
  }
});

export const setMuted = spacetimedb.reducer(
  { roomId: t.u64(), muted: t.bool() },
  (ctx, { roomId, muted }) => {
    const { member } = requireMembership(ctx, roomId);
    const session = ctx.db.voice_session.roomId.find(roomId);
    if (!session) return;
    for (const vp of [
      ...ctx.db.voice_participant.by_session_member.filter([session.id, member.id]),
    ]) {
      ctx.db.voice_participant.id.update({ ...vp, muted });
    }
  }
);

/** Voice activity, throttled by the client. Expires on its own. */
export const pingSpeaking = spacetimedb.reducer({ roomId: t.u64() }, (ctx, { roomId }) => {
  const { member } = requireMembership(ctx, roomId);
  const session = ctx.db.voice_session.roomId.find(roomId);
  if (!session) return;
  for (const vp of [
    ...ctx.db.voice_participant.by_session_member.filter([session.id, member.id]),
  ]) {
    ctx.db.voice_participant.id.update({
      ...vp,
      speakingUntil: new Timestamp(ctx.timestamp.microsSinceUnixEpoch + SPEAKING_WINDOW_MICROS),
    });
  }
});

export const sendSignal = spacetimedb.reducer(
  { roomId: t.u64(), toMemberId: t.u64(), kind: t.string(), payload: t.string() },
  (ctx, { roomId, toMemberId, kind, payload }) => {
    const { member } = requireMembership(ctx, roomId);
    const session = ctx.db.voice_session.roomId.find(roomId);
    if (!session) return;
    ctx.db.signal.insert({
      id: 0n,
      sessionId: session.id,
      fromMemberId: member.id,
      toMemberId,
      kind,
      payload,
      createdAt: ctx.timestamp,
    });
  }
);

/** Signalling rows are single-use: the recipient deletes them once applied. */
export const consumeSignal = spacetimedb.reducer(
  { signalId: t.u64() },
  (ctx, { signalId }) => {
    ctx.db.signal.id.delete(signalId);
  }
);

/* ---------------------------------------------------- Room superlatives --- */
//
// "Today's Titles" — one playful superlative per member, recomputed by the daily
// pass every tick so the Live-tab card is genuinely live rather than an
// end-of-day reveal. Everything is derived from tables that already exist; there
// is no separate tracking table. A category with no real activity (winning count
// of zero) is skipped for the day rather than handed out arbitrarily.

const TITLE_TYPES = [
  'craziest_one',
  'most_active',
  'roast_champion',
  'life_of_room',
  'streak_legend',
  'night_owl',
] as const;

/** Moments before 05:00 UTC count as "night". The app has no per-room zone (the
 *  same limitation the scheduled-prompt times live with), so this is UTC. */
const NIGHT_END_MINS = 300;

function computeRoomTitles(ctx: any, today: number, since: bigint) {
  type Tally = Map<bigint, Map<bigint, number>>;
  const mkTally = (): Tally => new Map();
  const bump = (tally: Tally, roomId: bigint, memberId: bigint, n = 1) => {
    if (memberId === 0n) return;
    let inner = tally.get(roomId);
    if (!inner) {
      inner = new Map();
      tally.set(roomId, inner);
    }
    inner.set(memberId, (inner.get(memberId) ?? 0) + n);
  };

  const mostActive = mkTally();
  const nightOwl = mkTally();
  const lifeOfRoom = mkTally();
  const craziest = mkTally();
  const roastVotes = mkTally();

  // A moment's room + author, memoised — reactions and roast reactions both
  // need it and a moment can draw many of each.
  const momentInfo = new Map<bigint, { roomId: bigint; memberId: bigint } | null>();
  const infoFor = (momentId: bigint) => {
    const cached = momentInfo.get(momentId);
    if (cached !== undefined) return cached;
    const mo = ctx.db.moment.id.find(momentId);
    const value = mo ? { roomId: mo.roomId, memberId: mo.memberId } : null;
    momentInfo.set(momentId, value);
    return value;
  };

  for (const mo of [...ctx.db.moment.iter()]) {
    if (mo.createdAt.microsSinceUnixEpoch < since) continue;
    momentInfo.set(mo.id, { roomId: mo.roomId, memberId: mo.memberId });
    bump(mostActive, mo.roomId, mo.memberId);
    if (minutesOfDayUTC(mo.createdAt) < NIGHT_END_MINS) {
      bump(nightOwl, mo.roomId, mo.memberId);
    }
  }

  for (const rc of [...ctx.db.reaction.iter()]) {
    if (rc.createdAt.microsSinceUnixEpoch < since) continue;
    const info = infoFor(rc.momentId);
    if (info) bump(lifeOfRoom, info.roomId, info.memberId);
  }

  for (const rr of [...ctx.db.roast_reaction.iter()]) {
    if (rr.createdAt.microsSinceUnixEpoch < since || rr.heatLevel !== 'savage') continue;
    const info = infoFor(rr.momentId);
    if (info) bump(craziest, info.roomId, info.memberId);
  }

  for (const v of [...ctx.db.roast_vote.iter()]) {
    if (v.createdAt.microsSinceUnixEpoch < since) continue;
    const parent = ctx.db.roast.id.find(v.roastId);
    if (parent) bump(roastVotes, parent.roomId, parent.authorMembershipId);
  }

  // Streak Legend — the longest current streak in the room right now.
  const streakLegend = new Map<bigint, { memberId: bigint; streak: number }>();
  for (const m of [...ctx.db.room_member.iter()]) {
    if (m.currentStreak <= 0) continue;
    const best = streakLegend.get(m.roomId);
    if (!best || m.currentStreak > best.streak) {
      streakLegend.set(m.roomId, { memberId: m.id, streak: m.currentStreak });
    }
  }

  // Highest count wins; a tie keeps the first seen; zero means "skip this title".
  const pickTop = (inner: Map<bigint, number> | undefined): bigint => {
    if (!inner) return 0n;
    let bestId = 0n;
    let best = 0;
    for (const [memberId, count] of inner) {
      if (count > best) {
        best = count;
        bestId = memberId;
      }
    }
    return best > 0 ? bestId : 0n;
  };

  for (const home of [...ctx.db.room.iter()]) {
    const winners: Record<(typeof TITLE_TYPES)[number], bigint> = {
      craziest_one: pickTop(craziest.get(home.id)),
      most_active: pickTop(mostActive.get(home.id)),
      roast_champion: pickTop(roastVotes.get(home.id)),
      life_of_room: pickTop(lifeOfRoom.get(home.id)),
      streak_legend: streakLegend.get(home.id)?.memberId ?? 0n,
      night_owl: pickTop(nightOwl.get(home.id)),
    };

    const todayRows = new Map<string, any>();
    for (const rt of [...ctx.db.room_title.roomId.filter(home.id)]) {
      if (rt.awardedForDate !== today) {
        ctx.db.room_title.id.delete(rt.id); // yesterday's — drop it
      } else {
        todayRows.set(rt.titleType, rt);
      }
    }

    for (const type of TITLE_TYPES) {
      const memberId = winners[type];
      const row = todayRows.get(type);
      if (memberId === 0n) {
        if (row) ctx.db.room_title.id.delete(row.id);
      } else if (!row) {
        ctx.db.room_title.insert({
          id: 0n,
          roomId: home.id,
          memberId,
          titleType: type,
          awardedForDate: today,
        });
      } else if (row.memberId !== memberId) {
        ctx.db.room_title.id.update({ ...row, memberId });
      }
    }
  }
}

/* --------------------------------------------------------------- Upkeep --- */

export const sweep = spacetimedb.reducer(
  { timer: sweep_timer.rowType },
  (ctx, _args) => {
    const cutoff = ctx.timestamp.microsSinceUnixEpoch - SIGNAL_TTL_MICROS;
    for (const s of [...ctx.db.signal.iter()]) {
      if (s.createdAt.microsSinceUnixEpoch < cutoff) ctx.db.signal.id.delete(s.id);
    }
    // A session whose participants all vanished (crash, closed laptop) shouldn't
    // keep advertising itself as live.
    for (const session of [...ctx.db.voice_session.iter()]) {
      const count = [...ctx.db.voice_participant.sessionId.filter(session.id)].length;
      if (count === 0) ctx.db.voice_session.id.delete(session.id);
    }

    /* ---- daily pass ---------------------------------------------------- *
     * Idempotent: the streak reset only fires once (streak is then 0) and the
     * badge awards dedupe on "already held today", so running every tick is
     * wasteful but never wrong. */
    const today = dayOrdinal(ctx.timestamp);
    const since = dayStartMicros(today);

    // Missed a day → the streak is broken.
    for (const m of [...ctx.db.room_member.iter()]) {
      if (m.currentStreak > 0 && m.lastMomentDate > 0 && m.lastMomentDate < today - 1) {
        ctx.db.room_member.id.update({ ...m, currentStreak: 0 });
      }
    }

    // roast_champion — the author of today's top-voted roast in each room.
    const topRoast = new Map<bigint, { authorId: bigint; votes: number }>();
    for (const r of [...ctx.db.roast.iter()]) {
      if (r.createdAt.microsSinceUnixEpoch < since) continue;
      const votes = [...ctx.db.roast_vote.roastId.filter(r.id)].length;
      const best = topRoast.get(r.roomId);
      if (!best || votes > best.votes) {
        topRoast.set(r.roomId, { authorId: r.authorMembershipId, votes });
      }
    }
    for (const { authorId, votes } of topRoast.values()) {
      if (votes >= 1) awardBadge(ctx, authorId, 'roast_champion', since);
    }

    // most_reactions — whose moments drew the most reactions in each room today.
    const reactionTally = new Map<bigint, Map<bigint, number>>();
    for (const mo of [...ctx.db.moment.iter()]) {
      if (mo.createdAt.microsSinceUnixEpoch < since) continue;
      const count = [...ctx.db.reaction.momentId.filter(mo.id)].length;
      if (count === 0) continue;
      let inner = reactionTally.get(mo.roomId);
      if (!inner) {
        inner = new Map();
        reactionTally.set(mo.roomId, inner);
      }
      inner.set(mo.memberId, (inner.get(mo.memberId) ?? 0) + count);
    }
    for (const inner of reactionTally.values()) {
      let bestId = 0n;
      let best = 0;
      for (const [memberId, count] of inner) {
        if (count > best) {
          best = count;
          bestId = memberId;
        }
      }
      if (best >= 3 && bestId !== 0n) awardBadge(ctx, bestId, 'most_reactions', since);
    }

    // Scheduled prompts — fire each active slot (a room can queue several) whose
    // UTC time has arrived within the last couple of hours and that hasn't fired
    // yet today. The window keeps a slot missed by a brief restart, without
    // dumping the morning's prompt out in the evening.
    const nowMins = minutesOfDayUTC(ctx.timestamp);
    for (const sched of [...ctx.db.room_prompt_schedule.iter()]) {
      if (!sched.isActive || sched.lastFiredDate === today) continue;
      const at = parseHHMM(sched.scheduledTime);
      if (at < 0 || nowMins < at || nowMins - at > 120) continue;
      const home = ctx.db.room.id.find(sched.roomId);
      if (!home) continue;
      const text = scheduledPromptText(ctx, home, sched);
      ctx.db.room_prompt_schedule.id.update({ ...sched, lastFiredDate: today });
      if (text) firePrompt(ctx, sched.roomId, text, sched.source);
    }

    // A live prompt goes stale after a day.
    for (const p of [...ctx.db.room_prompt.iter()]) {
      if (ctx.timestamp.microsSinceUnixEpoch - p.startedAt.microsSinceUnixEpoch > DAY_MICROS) {
        ctx.db.room_prompt.id.delete(p.id);
      }
    }

    // "Today's Titles" — recomputed each tick from today's activity.
    computeRoomTitles(ctx, today, since);
  }
);

/* ------------------------------------------------------------ Demo rooms -- */
//
// A brand-new account opens to an empty app, which is honest but lonely. This
// seeds three rooms full of people. The demo members live in the same tables as
// everyone else, so every screen, subscription and animation exercises the real
// code path.

const PHOTO = (seed: string) => `https://picsum.photos/seed/${seed}/900/1200`;
const FACE = (n: number) => `https://i.pravatar.cc/240?img=${n}`;

type DemoPerson = { name: string; face: number; emoji: string; activity: string };
type DemoMoment = { by: number; seed: string; caption: string; agoMins: number };
type DemoMessage = { by: number; text: string; agoMins: number };
type DemoRoom = {
  name: string;
  emoji: string;
  kind: string;
  cover: string;
  people: DemoPerson[];
  moments: DemoMoment[];
  chat: DemoMessage[];
};

const DEMO_ROOMS: DemoRoom[] = [
  {
    name: 'Family',
    emoji: '❤️',
    kind: 'family',
    cover: 'chai-family',
    people: [
      { name: 'Mom', face: 45, emoji: '🍳', activity: 'Cooking dinner' },
      { name: 'Dad', face: 60, emoji: '📺', activity: 'Watching TV' },
      { name: 'Aisha', face: 31, emoji: '🎧', activity: 'Listening to music' },
      { name: 'Ahmed', face: 33, emoji: '🏫', activity: 'At college' },
    ],
    moments: [
      { by: 0, seed: 'chai-biryani', caption: 'Cooking dinner for my favourite people ❤️', agoMins: 4 },
      { by: 2, seed: 'chai-balcony', caption: 'Evening chai hits different', agoMins: 52 },
      { by: 1, seed: 'chai-cat', caption: 'he refuses to move', agoMins: 190 },
    ],
    chat: [
      { by: 2, text: 'that smells incredible from here', agoMins: 3 },
      { by: 0, text: 'come down in ten ❤️', agoMins: 2 },
      { by: 3, text: 'save me some, bus is stuck 😭', agoMins: 1 },
    ],
  },
  {
    name: 'Goa Trip',
    emoji: '🏝️',
    kind: 'trip',
    cover: 'chai-goa',
    people: [
      { name: 'Bilal', face: 12, emoji: '🏖️', activity: 'On the beach' },
      { name: 'Sara', face: 5, emoji: '🚗', activity: 'Driving to Anjuna' },
      { name: 'Zoya', face: 20, emoji: '📸', activity: 'Taking photos' },
    ],
    moments: [
      { by: 2, seed: 'chai-sunset', caption: 'ok this sunset is unreal 🌅', agoMins: 18 },
      { by: 0, seed: 'chai-beach', caption: 'water is warm. come now.', agoMins: 120 },
    ],
    chat: [
      { by: 1, text: 'twenty minutes out, save a chair', agoMins: 9 },
      { by: 0, text: 'two chairs and a coconut 🥥', agoMins: 8 },
    ],
  },
  {
    name: 'College Friends',
    emoji: '🎓',
    kind: 'college',
    cover: 'chai-college',
    people: [
      { name: 'Fatima', face: 47, emoji: '📖', activity: 'Studying' },
      { name: 'Omar', face: 15, emoji: '🎮', activity: 'Gaming' },
      { name: 'Hina', face: 9, emoji: '☕', activity: 'At the cafe' },
    ],
    moments: [
      { by: 0, seed: 'chai-library', caption: 'day 3 of pretending to study', agoMins: 35 },
      { by: 2, seed: 'chai-cafe', caption: 'cutting class, worth it', agoMins: 240 },
    ],
    chat: [
      { by: 1, text: 'anyone got the notes from friday', agoMins: 22 },
      { by: 0, text: 'sending now, you owe me chai', agoMins: 20 },
    ],
  },
];

const ACTIVITY_POOL: Record<string, Array<[string, string]>> = {
  family: [
    ['🍳', 'Cooking'],
    ['🍛', 'Eating'],
    ['☕', 'Chai break'],
    ['🏠', 'At home'],
    ['🎧', 'Listening to music'],
    ['📺', 'Watching TV'],
    ['😴', 'Sleeping'],
    ['🏋️', 'At the gym'],
  ],
  trip: [
    ['🏖️', 'On the beach'],
    ['🚗', 'Driving'],
    ['✈️', 'Travelling'],
    ['📸', 'Taking photos'],
    ['🍛', 'Eating everything'],
    ['🌅', 'Chasing the sunset'],
  ],
  college: [
    ['🏫', 'At college'],
    ['📖', 'Studying'],
    ['🎮', 'Gaming'],
    ['☕', 'At the cafe'],
    ['💻', 'Working'],
    ['🏋️', 'At the gym'],
  ],
};

const DEMO_CAPTIONS = [
  'look at this 👀',
  'quick one before it disappears',
  'this is my whole mood today',
  'had to share',
  'ok last one i promise',
  'you had to be here',
  'right now 🌤️',
];

const DEMO_CHATTER = [
  'wait what 😂',
  'okay that is gorgeous',
  'omw',
  'send more!!',
  'this made my day honestly',
  'why was i not invited',
  '❤️❤️',
];

const DEMO_PHOTO_SEEDS = [
  'chai-street',
  'chai-coffee',
  'chai-window',
  'chai-dog',
  'chai-plants',
  'chai-night',
  'chai-market',
  'chai-sky',
];

function pick<T>(ctx: any, list: T[]): T {
  return list[ctx.random.integerInRange(0, list.length - 1)];
}

/** Six unambiguous characters — no 0/O/1/I. Matches the client's generator. */
function demoCode(ctx: any): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[ctx.random.integerInRange(0, alphabet.length - 1)];
  }
  return out;
}

function minutesAgo(ctx: any, mins: number) {
  return new Timestamp(
    ctx.timestamp.microsSinceUnixEpoch - BigInt(Math.round(mins * 60)) * 1_000_000n
  );
}

export const seedDemoRooms = spacetimedb.reducer((ctx) => {
  const me = requirePerson(ctx);
  ensureContentSeeded(ctx);
  if ([...ctx.db.room_member.personId.filter(me.id)].length > 0) return;

  for (const preset of DEMO_ROOMS) {
    let code = demoCode(ctx);
    for (let i = 0; i < 5 && ctx.db.room.code.find(code); i++) code = demoCode(ctx);
    if (ctx.db.room.code.find(code)) continue;

    const created = ctx.db.room.insert({
      id: 0n,
      code,
      name: preset.name,
      emoji: preset.emoji,
      kind: preset.kind,
      coverUrl: PHOTO(preset.cover),
      isEvent: false,
      ownerId: me.id,
      createdAt: ctx.timestamp,
      lastActivityAt: ctx.timestamp,
      roastMode: false,
    });

    addMember(ctx, created.id, me);

    const today = dayOrdinal(ctx.timestamp);
    // A spread of streaks so the flame has range: one cold, one mid, one hot,
    // one past the 7-day badge line.
    const DEMO_STREAKS = [2, 5, 9, 14];

    const memberIds: bigint[] = [];
    preset.people.forEach((p, index) => {
      const streak = DEMO_STREAKS[index % DEMO_STREAKS.length];
      const row = ctx.db.room_member.insert({
        id: 0n,
        roomId: created.id,
        personId: 0n,
        displayName: p.name,
        avatarUrl: FACE(p.face),
        status: index === preset.people.length - 1 ? 'away' : 'online',
        activity: p.activity,
        activityEmoji: p.emoji,
        isDemo: true,
        viewing: index < 2,
        typingUntil: ctx.timestamp,
        joinedAt: ctx.timestamp,
        lastSeenAt: ctx.timestamp,
        currentStreak: streak,
        longestStreak: streak + index * 3,
        lastMomentDate: today,
        lastReplayMicros: 0n,
      });
      memberIds.push(row.id);
      if (streak >= 7) awardBadge(ctx, row.id, '7_day_streak');
    });

    for (const m of preset.moments) {
      const at = minutesAgo(ctx, m.agoMins);
      const mediaRow = ctx.db.media.insert({
        id: 0n,
        roomId: created.id,
        memberId: memberIds[m.by],
        kind: 'photo',
        url: PHOTO(m.seed),
        posterUrl: '',
        mimeType: 'image/jpeg',
        width: 900,
        height: 1200,
        durationMs: 0,
        sizeBytes: 0,
        waveform: '',
        createdAt: at,
      });
      const posted = ctx.db.moment.insert({
        id: 0n,
        roomId: created.id,
        memberId: memberIds[m.by],
        kind: 'photo',
        mediaId: mediaRow.id,
        caption: m.caption,
        createdAt: at,
      });
      const reactors = memberIds.filter((id) => id !== memberIds[m.by]).slice(0, 2);
      const emojis = ['❤️', '😂'];
      reactors.forEach((memberId, i) => {
        ctx.db.reaction.insert({
          id: 0n,
          momentId: posted.id,
          memberId,
          emoji: emojis[i % emojis.length],
          createdAt: at,
        });
      });
    }

    for (const c of preset.chat) {
      ctx.db.message.insert({
        id: 0n,
        roomId: created.id,
        memberId: memberIds[c.by],
        kind: 'text',
        text: c.text,
        mediaId: 0n,
        momentId: 0n,
        createdAt: minutesAgo(ctx, c.agoMins),
      });
    }

    /* ---- a scripted last ~14 minutes, so "Replay the room" is a real
     *      story on the very first press: people arriving, sharing, reacting,
     *      a voice room opening, then a burst of moments all at once. ---- */
    const pIdx = (n: number) => Math.min(n, preset.people.length - 1);
    logEventAt(ctx, created.id, 'online', memberIds[pIdx(2)], `${preset.people[pIdx(2)].name} came online`, minutesAgo(ctx, 13));
    logEventAt(ctx, created.id, 'online', memberIds[pIdx(1)], `${preset.people[pIdx(1)].name} came online`, minutesAgo(ctx, 8));

    const seedMoment = (rawIdx: number, seed: string, caption: string, agoMins: number, kind = 'photo') => {
      const byIdx = pIdx(rawIdx);
      const at = minutesAgo(ctx, agoMins);
      const media = ctx.db.media.insert({
        id: 0n,
        roomId: created.id,
        memberId: memberIds[byIdx],
        kind: kind === 'voice' ? 'voice' : 'photo',
        url: kind === 'voice' ? '' : PHOTO(seed),
        posterUrl: '',
        mimeType: kind === 'voice' ? 'audio/webm' : 'image/jpeg',
        width: kind === 'voice' ? 0 : 900,
        height: kind === 'voice' ? 0 : 1200,
        durationMs: kind === 'voice' ? 7000 : 0,
        sizeBytes: 0,
        waveform: kind === 'voice' ? 'k7m3p9q2h5r8' : '',
        createdAt: at,
      });
      const mom = ctx.db.moment.insert({
        id: 0n,
        roomId: created.id,
        memberId: memberIds[byIdx],
        kind,
        mediaId: media.id,
        caption,
        createdAt: at,
      });
      logEventAt(ctx, created.id, 'posted', memberIds[byIdx], `${preset.people[byIdx].name} shared a moment`, at);
      return mom;
    };

    const early = seedMoment(0, `${preset.cover}-replay1`, preset.moments[0]?.caption ?? 'look at this', 11);
    ctx.db.reaction.insert({ id: 0n, momentId: early.id, memberId: memberIds[pIdx(1)], emoji: '😂', createdAt: minutesAgo(ctx, 9) });
    logEventAt(ctx, created.id, 'reacted', memberIds[pIdx(1)], `${preset.people[pIdx(1)].name} reacted 😂`, minutesAgo(ctx, 9));

    seedMoment(2, '', '', 6, 'voice');
    logEventAt(ctx, created.id, 'voice_started', memberIds[pIdx(3)], `${preset.people[pIdx(3)].name} started a voice room`, minutesAgo(ctx, 5));

    // The collision: everyone captures within the same couple of minutes.
    const burst = ['chai-street', 'chai-window', 'chai-market', 'chai-sky'];
    const burstAt = [3, 2.5, 2, 1];
    const burstCaption = ['right now 🌤️', 'had to share', 'you had to be here', 'this is my whole mood'];
    preset.people.forEach((_p, i) => {
      seedMoment(i, `${burst[i % burst.length]}-${code}`, burstCaption[i % 4], burstAt[i % burstAt.length]);
    });

    touchRoom(ctx, created.id);
  }
});

/**
 * The heartbeat that makes a demo room feel inhabited: activities drift, people
 * come and go, and every so often somebody posts or says something. Each change
 * is an ordinary row update, so clients get it through their existing
 * subscription with no special casing.
 */
export const demoTick = spacetimedb.reducer(
  { timer: demo_tick_timer.rowType },
  (ctx, _args) => {
    const demoMembers = [...ctx.db.room_member.iter()].filter((m: any) => m.isDemo);
    if (demoMembers.length === 0) return;

    const nudges = Math.min(2, demoMembers.length);
    for (let i = 0; i < nudges; i++) {
      const target: any = pick(ctx, demoMembers);
      const home = ctx.db.room.id.find(target.roomId);
      const pool = ACTIVITY_POOL[home?.kind ?? 'family'] ?? ACTIVITY_POOL.family;
      const [emoji, activity] = pick(ctx, pool);
      const roll = ctx.random();
      const nextStatus = roll < 0.15 ? 'away' : 'online';
      if (nextStatus === 'online') logCameOnline(ctx, target);
      ctx.db.room_member.id.update({
        ...target,
        activity,
        activityEmoji: emoji,
        status: nextStatus,
        viewing: roll > 0.55,
        lastSeenAt: ctx.timestamp,
      });
    }

    // Somebody starts typing — the indicator expires on its own.
    if (ctx.random() < 0.3) {
      const typist: any = pick(ctx, demoMembers);
      ctx.db.room_member.id.update({
        ...typist,
        typingUntil: new Timestamp(
          ctx.timestamp.microsSinceUnixEpoch + TYPING_WINDOW_MICROS
        ),
      });
    }

    // …and sometimes actually says it.
    if (ctx.random() < 0.22) {
      const talker: any = pick(ctx, demoMembers);
      const existing = [...ctx.db.message.roomId.filter(talker.roomId)].length;
      if (existing < 40) {
        ctx.db.message.insert({
          id: 0n,
          roomId: talker.roomId,
          memberId: talker.id,
          kind: 'text',
          text: pick(ctx, DEMO_CHATTER),
          mediaId: 0n,
          momentId: 0n,
          createdAt: ctx.timestamp,
        });
        touchRoom(ctx, talker.roomId);
      }
    }

    if (ctx.random() < 0.16) {
      const author: any = pick(ctx, demoMembers);
      const existing = [...ctx.db.moment.roomId.filter(author.roomId)].length;
      if (existing < 12) {
        const mediaRow = ctx.db.media.insert({
          id: 0n,
          roomId: author.roomId,
          memberId: author.id,
          kind: 'photo',
          url: PHOTO(`${pick(ctx, DEMO_PHOTO_SEEDS)}-${ctx.random.integerInRange(1, 999)}`),
          posterUrl: '',
          mimeType: 'image/jpeg',
          width: 900,
          height: 1200,
          durationMs: 0,
          sizeBytes: 0,
          waveform: '',
          createdAt: ctx.timestamp,
        });
        ctx.db.moment.insert({
          id: 0n,
          roomId: author.roomId,
          memberId: author.id,
          kind: 'photo',
          mediaId: mediaRow.id,
          caption: pick(ctx, DEMO_CAPTIONS),
          createdAt: ctx.timestamp,
        });
        logEvent(ctx, author.roomId, 'posted', author.id, `${author.displayName} shared a moment`);
        touchRoom(ctx, author.roomId);
      }
    }
  }
);
