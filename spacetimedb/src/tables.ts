/**
 * Chai Time — table definitions.
 *
 * These are assembled into the module schema by `index.ts`, which also owns the
 * scheduled tables so each one can sit next to the reducer it fires.
 *
 * A room is a shared live space, so the tables are organised by what the room
 * is doing rather than by entity:
 *
 *   who is here      person, room_member (presence lives on the membership row)
 *   what they shared moment, media, reaction
 *   what they said   message
 *   who is talking   voice_session, voice_participant, signal
 *   what just went   room_event
 *
 * Two rules run through all of it:
 *
 *  1. Everything room-scoped references a `room_member` row id, never an
 *     Identity. Authorship is then uniform across real and seeded members.
 *  2. Bytes never live in a row. `media` holds a *reference* — the URL, type,
 *     dimensions, duration and waveform — exactly the shape an object store
 *     (R2/S3) hands back. See MEDIA STORAGE in index.ts.
 */
import { table, t } from 'spacetimedb/server';

export const person = table(
  { name: 'person', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    identity: t.identity().unique(),
    handle: t.string(),
    displayName: t.string(),
    avatarUrl: t.string(),
    bio: t.string(),
    createdAt: t.timestamp(),
  }
);

export const room = table(
  { name: 'room', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    code: t.string().unique(),
    name: t.string(),
    emoji: t.string(),
    /** 'family' | 'friends' | 'trip' | 'event' | 'college' | 'other' — mood only. */
    kind: t.string(),
    coverUrl: t.string(),
    /** Event mode turns the room louder: live banner, counts, energy. */
    isEvent: t.bool(),
    ownerId: t.u64(),
    createdAt: t.timestamp(),
    lastActivityAt: t.timestamp(),
    /** Roast mode: playful pile-ons on a moment. Toggled only by the owner. */
    roastMode: t.bool().default(false),
  }
);

export const room_member = table(
  {
    name: 'room_member',
    public: true,
    indexes: [
      { accessor: 'by_room_person', algorithm: 'btree', columns: ['roomId', 'personId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().index('btree'),
    /** 0 = a seeded demo member (no identity behind it). */
    personId: t.u64().index('btree'),
    displayName: t.string(),
    avatarUrl: t.string(),
    /** 'online' | 'away' | 'offline' */
    status: t.string(),
    activity: t.string(),
    activityEmoji: t.string(),
    isDemo: t.bool(),
    viewing: t.bool(),
    typingUntil: t.timestamp(),
    joinedAt: t.timestamp(),
    lastSeenAt: t.timestamp(),
    /* ---- Streaks --------------------------------------------------------- *
     * Consecutive days this member posted a moment. `lastMomentDate` is a UTC
     * day ordinal (whole days since the epoch) so "was it yesterday?" is one
     * integer comparison and stays deterministic inside a reducer. */
    currentStreak: t.u32().default(0),
    longestStreak: t.u32().default(0),
    lastMomentDate: t.u32().default(0),
    /** Micros-since-epoch of the last time this member replayed / caught up on
     *  the room. 0 = never — "Replay the room" then shows everything. */
    lastReplayMicros: t.u64().default(0n),
  }
);

/**
 * A reference to a file living in object storage. The row is deliberately
 * small: id, where it is, what it is, and just enough metadata to lay it out
 * before it loads (dimensions, duration, waveform).
 */
export const media = table(
  { name: 'media', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().index('btree'),
    memberId: t.u64(),
    /** 'photo' | 'video' | 'voice' */
    kind: t.string(),
    url: t.string(),
    mimeType: t.string(),
    width: t.u32(),
    height: t.u32(),
    durationMs: t.u32(),
    sizeBytes: t.u32(),
    /** Voice only: one base-36 character per waveform bar. */
    waveform: t.string(),
    createdAt: t.timestamp(),
    /**
     * Video only: a still frame (JPEG) grabbed at upload time, so the UI has
     * something to show before the clip is tapped. Empty for photos and voice,
     * and for video rows written before this column existed. Appended last so
     * the schema change is a plain additive migration.
     */
    posterUrl: t.string().default(''),
  }
);

export const moment = table(
  { name: 'moment', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().index('btree'),
    memberId: t.u64().index('btree'),
    /** 'photo' | 'video' | 'voice' | 'text' */
    kind: t.string(),
    /** 0 for a text-only moment. */
    mediaId: t.u64().index('btree'),
    caption: t.string(),
    createdAt: t.timestamp(),
  }
);

export const message = table(
  { name: 'message', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().index('btree'),
    memberId: t.u64(),
    /** 'text' | 'photo' | 'video' | 'voice' */
    kind: t.string(),
    text: t.string(),
    mediaId: t.u64(),
    /** Keeps chat tied to what it is about; 0 = not a reply to a moment. */
    momentId: t.u64().index('btree'),
    createdAt: t.timestamp(),
  }
);

export const reaction = table(
  { name: 'reaction', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    momentId: t.u64().index('btree'),
    memberId: t.u64(),
    emoji: t.string(),
    createdAt: t.timestamp(),
  }
);

export const room_event = table(
  { name: 'room_event', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().index('btree'),
    /** 'created' | 'joined' | 'left' | 'posted' | 'voice_started' | 'voice_ended' */
    kind: t.string(),
    memberId: t.u64(),
    text: t.string(),
    createdAt: t.timestamp(),
  }
);

/* ---------------------------------------------------- Rewards & roasts --- */

/**
 * A badge is awarded once and never taken away. Streak badges are minted inside
 * `postMoment`; `roast_champion` and `most_reactions` are minted by the daily
 * pass inside `sweep`. `membershipId` ties the badge to a room membership, in
 * keeping with the rest of the schema.
 */
export const badge = table(
  {
    name: 'badge',
    public: true,
    indexes: [
      { accessor: 'by_member_type', algorithm: 'btree', columns: ['membershipId', 'badgeType'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    membershipId: t.u64(),
    /** '7_day_streak' | '30_day_streak' | 'roast_champion' | 'most_reactions' */
    badgeType: t.string(),
    awardedAt: t.timestamp(),
  }
);

/** One playful pile-on aimed at a moment. `roomId` is denormalised (as on
 * `media` and `voice_participant`) so "roasts in this room today" is cheap. */
export const roast = table(
  { name: 'roast', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().index('btree'),
    momentId: t.u64().index('btree'),
    authorMembershipId: t.u64(),
    text: t.string(),
    createdAt: t.timestamp(),
  }
);

/** One vote per membership per roast — enforced by the reducer against the
 * `by_roast_member` index. */
export const roast_vote = table(
  {
    name: 'roast_vote',
    public: true,
    indexes: [
      { accessor: 'by_roast_member', algorithm: 'btree', columns: ['roastId', 'membershipId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    roastId: t.u64().index('btree'),
    membershipId: t.u64(),
    createdAt: t.timestamp(),
  }
);

/**
 * Room superlatives — one "title" a member holds for a day, recomputed by the
 * daily pass in `sweep` from data that already exists (moments, reactions,
 * roasts, roast reactions, streaks). `awardedForDate` is a UTC day ordinal, and
 * there is at most one row per (room, titleType) per day: the daily pass
 * reconciles rows rather than appending, so the card stays live without growing
 * the table.
 */
export const room_title = table(
  { name: 'room_title', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().index('btree'),
    memberId: t.u64(),
    /**
     * 'craziest_one' | 'most_active' | 'roast_champion' | 'life_of_room' |
     * 'streak_legend' | 'night_owl'
     */
    titleType: t.string(),
    awardedForDate: t.u32(),
  }
);

/* ------------------------------------------------------------ Live voice -- */

/**
 * One live voice room at a time per room. The row existing *is* the session;
 * ending it deletes the row, so "is anyone talking?" is a single lookup.
 */
export const voice_session = table(
  { name: 'voice_session', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().unique(),
    startedBy: t.u64(),
    startedAt: t.timestamp(),
  }
);

export const voice_participant = table(
  {
    name: 'voice_participant',
    public: true,
    indexes: [
      { accessor: 'by_session_member', algorithm: 'btree', columns: ['sessionId', 'memberId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    sessionId: t.u64().index('btree'),
    roomId: t.u64().index('btree'),
    memberId: t.u64().index('btree'),
    /** Indexed so a disconnect can pull someone out of voice in one lookup. */
    personId: t.u64().index('btree'),
    muted: t.bool(),
    /** Voice activity is a timestamp, not a flag — it expires on its own. */
    speakingUntil: t.timestamp(),
    joinedAt: t.timestamp(),
  }
);

/**
 * WebRTC signalling only. Audio never touches the database — this table just
 * carries offers, answers and ICE candidates between two peers, and rows are
 * deleted the moment they are consumed.
 */
export const signal = table(
  { name: 'signal', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    sessionId: t.u64().index('btree'),
    fromMemberId: t.u64(),
    toMemberId: t.u64().index('btree'),
    /** 'offer' | 'answer' | 'ice' | 'bye' */
    kind: t.string(),
    payload: t.string(),
    createdAt: t.timestamp(),
  }
);

/* ------------------------------------------------------ Scheduled prompts -- */

/**
 * Per-room prompt schedule. `scheduledTime` is "HH:MM" in **UTC** — a reducer
 * has no way to know a device's local zone, so the settings screen converts the
 * user's local pick to UTC before sending. `lastFiredDate` is a UTC day ordinal
 * so the daily pass fires each schedule at most once per day.
 */
export const room_prompt_schedule = table(
  { name: 'room_prompt_schedule', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().index('btree'),
    scheduledTime: t.string(),
    isActive: t.bool(),
    /** 'default_family' | 'default_friends' | 'custom' */
    source: t.string(),
    lastFiredDate: t.u32().default(0),
  }
);

/** Read-only default prompt packs, seeded once. */
export const prompt_library = table(
  { name: 'prompt_library', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    /** 'family' | 'friends' */
    roomType: t.string().index('btree'),
    text: t.string(),
  }
);

/** A room's own prompts. `active` marks the one a 'custom' schedule fires. */
export const custom_prompt = table(
  { name: 'custom_prompt', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().index('btree'),
    text: t.string(),
    createdBy: t.u64(),
    active: t.bool(),
    createdAt: t.timestamp(),
  }
);

/** The prompt currently live in a room — one row per room, replaced each cycle. */
export const room_prompt = table(
  { name: 'room_prompt', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().unique(),
    text: t.string(),
    source: t.string(),
    startedAt: t.timestamp(),
  }
);

/* ---------------------------------------------------- Fire roast reactions -- */

/** Read-only library of roast lines, seeded once. Grouped by style then heat in
 *  the UI. */
export const roast_line_library = table(
  { name: 'roast_line_library', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    /** 'flex' | 'dramatic' | 'lazy' | 'awkward' | 'chaos' */
    category: t.string(),
    /** 'mild' | 'spicy' | 'savage' */
    heatLevel: t.string().index('btree'),
    text: t.string(),
    /** 'fire' | 'devil' | 'skull' | 'clown' — the visual style it's filed under.
     *  Appended last: additive migration only. */
    style: t.string().default('fire'),
  }
);

/**
 * A tap-to-react roast on a moment — one per person per moment (a re-send
 * replaces it, like a chat reaction). `lineId` 0 means the sender typed their
 * own line in `customText`.
 */
export const roast_reaction = table(
  {
    name: 'roast_reaction',
    public: true,
    indexes: [
      { accessor: 'by_moment_member', algorithm: 'btree', columns: ['momentId', 'membershipId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    momentId: t.u64().index('btree'),
    membershipId: t.u64(),
    lineId: t.u64(),
    customText: t.string(),
    /** 'mild' | 'spicy' | 'savage' — drives how hot the send animation runs. */
    heatLevel: t.string(),
    createdAt: t.timestamp(),
    /** 'fire' | 'devil' | 'skull' | 'clown' — the emoji badge + landing effect.
     *  Appended last: additive migration only. */
    style: t.string().default('fire'),
  }
);
