/**
 * One room, fully assembled: who's here, what they're doing, what they shared,
 * what they said, and who's on voice.
 *
 * Every field below is derived from live tables, so a reaction landing on the
 * server is a re-render here — nothing is ever refetched.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';
import { debug } from '../lib/log';
import type {
  Media,
  Message,
  Moment,
  Reaction,
  Room,
  RoomEvent,
  RoomMember,
  VoiceParticipant,
  VoiceSession,
} from '../module_bindings/types';
import { useSession } from './useSession';
import { useNow } from './useNow';

export interface ReactionTally {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface MomentView {
  moment: Moment;
  media: Media | undefined;
  author: RoomMember | undefined;
  reactions: ReactionTally[];
  /** The chat messages that quote this moment — replies live in one place. */
  replies: Array<{ message: Message; author: RoomMember | undefined }>;
  isMine: boolean;
}

export interface MessageView {
  message: Message;
  media: Media | undefined;
  author: RoomMember | undefined;
  isMine: boolean;
  /** False when the previous message is from the same person in the same minute. */
  showAuthor: boolean;
  /** The moment this message is a reply to, when there is one. */
  aboutMoment: Moment | undefined;
}

/** A superlative held for the day, joined to the member who holds it. */
export interface RoomTitleView {
  titleType: string;
  member: RoomMember | undefined;
}

/** The order the "Today's Titles" card lists them in. */
const TITLE_ORDER = [
  'most_active',
  'life_of_room',
  'roast_champion',
  'craziest_one',
  'streak_legend',
  'night_owl',
];

export interface VoiceSeat {
  participant: VoiceParticipant;
  member: RoomMember | undefined;
  speaking: boolean;
  isMe: boolean;
}

export interface VoiceView {
  session: VoiceSession | undefined;
  seats: VoiceSeat[];
  live: boolean;
  iAmIn: boolean;
  me: VoiceParticipant | undefined;
}

export interface RoomView {
  ready: boolean;
  room: Room | undefined;
  notFound: boolean;
  isOwner: boolean;
  members: RoomMember[];
  me: RoomMember | undefined;
  isMember: boolean;
  online: RoomMember[];
  viewing: RoomMember[];
  typing: RoomMember[];
  moments: MomentView[];
  messages: MessageView[];
  gallery: Media[];
  events: RoomEvent[];
  titles: RoomTitleView[];
  voice: VoiceView;
  activeCount: number;
}

const STATUS_RANK: Record<string, number> = { online: 0, away: 1, offline: 2 };

const EMPTY_VOICE: VoiceView = {
  session: undefined,
  seats: [],
  live: false,
  iAmIn: false,
  me: undefined,
};

export function useRoom(code: string | undefined): RoomView {
  const { myPersonId, ready: sessionReady } = useSession();
  const [rooms, roomsReady] = useTable(tables.room);
  const [allMembers, membersReady] = useTable(tables.roomMember);
  const [allMoments, momentsReady] = useTable(tables.moment);
  const [allMessages] = useTable(tables.message);
  const [allMedia] = useTable(tables.media);
  const [allReactions] = useTable(tables.reaction);
  const [allEvents] = useTable(tables.roomEvent);
  const [allTitles] = useTable(tables.roomTitle);
  const [allSessions] = useTable(tables.voiceSession);
  const [allParticipants] = useTable(tables.voiceParticipant);

  const view = useMemo(() => {
    const ready = sessionReady && roomsReady && membersReady && momentsReady;
    const room = code ? rooms.find((r) => r.code === code) : undefined;

    if (!room) {
      return {
        ready,
        room: undefined,
        notFound: ready && !!code,
        isOwner: false,
        members: [],
        me: undefined,
        isMember: false,
        online: [],
        viewing: [],
        typing: [] as RoomMember[],
        moments: [],
        messages: [],
        gallery: [],
        events: [],
        titles: [],
        voice: EMPTY_VOICE,
        activeCount: 0,
      };
    }

    const members = [...allMembers.filter((m) => m.roomId === room.id)].sort(
      (a, b) =>
        (STATUS_RANK[a.status] ?? 3) - (STATUS_RANK[b.status] ?? 3) ||
        a.displayName.localeCompare(b.displayName)
    );
    const byMemberId = new Map(members.map((m) => [m.id, m]));
    const me = members.find((m) => myPersonId !== null && m.personId === myPersonId);

    const mediaById = new Map<bigint, Media>();
    for (const item of allMedia) {
      if (item.roomId === room.id) mediaById.set(item.id, item);
    }

    const reactionsByMoment = new Map<bigint, Reaction[]>();
    for (const r of allReactions) {
      const list = reactionsByMoment.get(r.momentId);
      if (list) list.push(r);
      else reactionsByMoment.set(r.momentId, [r]);
    }
    // Auto-increment ids aren't ordered — always sort by time.
    const roomMoments = [...allMoments.filter((m) => m.roomId === room.id)].sort((a, b) =>
      Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
    );
    const momentsById = new Map(roomMoments.map((m) => [m.id, m]));

    // Chat reads oldest → newest, and a message that carries a momentId is a
    // reply to that moment — so a moment's thread and the room's conversation
    // are the same rows, never two parallel systems.
    const roomMessages = [...allMessages.filter((m) => m.roomId === room.id)].sort((a, b) =>
      Number(a.createdAt.microsSinceUnixEpoch - b.createdAt.microsSinceUnixEpoch)
    );
    const repliesByMoment = new Map<bigint, Message[]>();
    for (const msg of roomMessages) {
      if (msg.momentId === 0n) continue;
      const list = repliesByMoment.get(msg.momentId);
      if (list) list.push(msg);
      else repliesByMoment.set(msg.momentId, [msg]);
    }

    const moments: MomentView[] = roomMoments.map((moment) => {
      const raw = reactionsByMoment.get(moment.id) ?? [];
      const order: string[] = [];
      const counts = new Map<string, { count: number; mine: boolean }>();
      for (const r of raw) {
        const entry = counts.get(r.emoji);
        if (entry) {
          entry.count += 1;
          entry.mine ||= !!me && r.memberId === me.id;
        } else {
          order.push(r.emoji);
          counts.set(r.emoji, { count: 1, mine: !!me && r.memberId === me.id });
        }
      }

      const replies = (repliesByMoment.get(moment.id) ?? []).map((message) => ({
        message,
        author: byMemberId.get(message.memberId),
      }));

      return {
        moment,
        media: moment.mediaId === 0n ? undefined : mediaById.get(moment.mediaId),
        author: byMemberId.get(moment.memberId),
        reactions: order.map((emoji) => ({ emoji, ...counts.get(emoji)! })),
        replies,
        isMine: !!me && moment.memberId === me.id,
      };
    });

    // Consecutive messages from one person within two minutes collapse into a
    // run, so the eye follows people rather than bubbles.
    const messages: MessageView[] = roomMessages.map((msg, i) => {
      const previous = roomMessages[i - 1];
      const sameRun =
        !!previous &&
        previous.memberId === msg.memberId &&
        msg.createdAt.microsSinceUnixEpoch - previous.createdAt.microsSinceUnixEpoch <
          120_000_000n;
      return {
        message: msg,
        media: msg.mediaId === 0n ? undefined : mediaById.get(msg.mediaId),
        author: byMemberId.get(msg.memberId),
        isMine: !!me && msg.memberId === me.id,
        showAuthor: !sameRun,
        aboutMoment: msg.momentId === 0n ? undefined : momentsById.get(msg.momentId),
      };
    });

    const gallery = [...mediaById.values()].sort((a, b) =>
      Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
    );

    const events = [...allEvents.filter((e) => e.roomId === room.id)].sort((a, b) =>
      Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
    );

    const titles: RoomTitleView[] = [...allTitles.filter((t) => t.roomId === room.id)]
      .sort((a, b) => {
        const ai = TITLE_ORDER.indexOf(a.titleType);
        const bi = TITLE_ORDER.indexOf(b.titleType);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      })
      .map((t) => ({ titleType: t.titleType, member: byMemberId.get(t.memberId) }));

    const session = allSessions.find((s) => s.roomId === room.id);
    const participants = session
      ? [...allParticipants.filter((p) => p.sessionId === session.id)].sort((a, b) =>
          Number(a.joinedAt.microsSinceUnixEpoch - b.joinedAt.microsSinceUnixEpoch)
        )
      : [];

    return {
      ready,
      room,
      notFound: false,
      isOwner: myPersonId !== null && room.ownerId === myPersonId,
      members,
      me,
      isMember: !!me,
      online: members.filter((m) => m.status === 'online'),
      viewing: members.filter((m) => m.viewing && m.id !== me?.id),
      typing: [] as RoomMember[],
      moments,
      messages,
      gallery,
      events,
      titles,
      voice: {
        session,
        seats: participants.map((participant) => ({
          participant,
          member: byMemberId.get(participant.memberId),
          speaking: false,
          isMe: !!me && participant.memberId === me.id,
        })),
        live: !!session,
        iAmIn: !!me && participants.some((p) => p.memberId === me.id),
        me: me ? participants.find((p) => p.memberId === me.id) : undefined,
      },
      activeCount: members.filter((m) => m.status === 'online').length,
    };
  }, [
    code,
    myPersonId,
    sessionReady,
    rooms,
    roomsReady,
    allMembers,
    membersReady,
    allMoments,
    momentsReady,
    allMessages,
    allMedia,
    allReactions,
    allEvents,
    allTitles,
    allSessions,
    allParticipants,
  ]);

  // Typing and voice activity both expire on a wall clock rather than on a row
  // change, so they are derived outside the main memo.
  //
  // Two things matter for performance, and getting either wrong makes an idle
  // room re-render (and, because MomentCard uses `layout`, re-measure layout)
  // once a second for as long as it's open — a permanent stutter that spikes
  // into an unresponsive hitch whenever the tab is foregrounded with a backlog:
  //
  //   1. Only run the 1s clock when something is actually counting down. An
  //      idle room (nobody typing, nobody on voice — the usual case) falls back
  //      to a 60s clock, so `useNow` stops waking this hook every second.
  //   2. Return the *previous* `typing` / `voice` reference whenever the value
  //      is unchanged, so `result` keeps its identity and the room subtree
  //      (every MomentCard, the presence grid, chat) skips the render entirely.
  const nowMs = Date.now();
  const someoneOnVoice = view.voice.seats.length > 0;
  const maybeTyping = view.members.some(
    (m) =>
      m.id !== view.me?.id &&
      // a little slack past expiry so the countdown finishes on the fast clock
      m.typingUntil.microsSinceUnixEpoch > BigInt(nowMs - 6000) * 1000n
  );
  const now = useNow(someoneOnVoice || maybeTyping ? 1000 : 60_000);

  const typingRef = useRef<RoomMember[]>([]);
  const typing = useMemo(() => {
    const cutoff = BigInt(now) * 1000n;
    const next = view.members.filter(
      (m) => m.typingUntil.microsSinceUnixEpoch > cutoff && m.id !== view.me?.id
    );
    const prev = typingRef.current;
    if (prev.length === next.length && next.every((m, i) => m.id === prev[i]?.id)) {
      return prev;
    }
    typingRef.current = next;
    return next;
  }, [now, view.members, view.me]);

  const voiceRef = useRef<VoiceView>(EMPTY_VOICE);
  const voice = useMemo(() => {
    const cutoff = BigInt(now) * 1000n;
    const seats = view.voice.seats.map((seat) => ({
      ...seat,
      speaking:
        !seat.participant.muted &&
        seat.participant.speakingUntil.microsSinceUnixEpoch > cutoff,
    }));
    const prev = voiceRef.current;
    const unchanged =
      prev.session === view.voice.session &&
      prev.live === view.voice.live &&
      prev.iAmIn === view.voice.iAmIn &&
      prev.me === view.voice.me &&
      prev.seats.length === seats.length &&
      seats.every(
        (s, i) =>
          prev.seats[i]?.participant === s.participant &&
          prev.seats[i]?.member === s.member &&
          prev.seats[i]?.speaking === s.speaking
      );
    if (unchanged) return prev;
    const next = { ...view.voice, seats };
    voiceRef.current = next;
    return next;
  }, [now, view.voice]);

  const result = useMemo(() => ({ ...view, typing, voice }), [view, typing, voice]);

  // Render-rate probe. An idle room should hand `Room` a new object only when
  // something actually changed — on the order of once a minute. A sustained
  // faster rate means an upstream value is churning identity, which is what
  // makes a long session feel progressively sluggish / stuck.
  const renderProbe = useRef({ n: 0, since: performance.now() });
  renderProbe.current.n += 1;
  if (renderProbe.current.n % 20 === 0) {
    const elapsed = performance.now() - renderProbe.current.since;
    debug('perf', 'useRoom render rate', {
      per10s: ((20 / elapsed) * 10_000).toFixed(1),
      total: renderProbe.current.n,
    });
    renderProbe.current.since = performance.now();
  }

  // Trace what this hook hands each screen — how the data resolves as we
  // navigate in and out of a room.
  useEffect(() => {
    debug('data', 'useRoom', {
      code,
      ready: result.ready,
      notFound: result.notFound,
      roomId: result.room ? String(result.room.id) : null,
      isMember: result.isMember,
      members: result.members.length,
      moments: result.moments.length,
      messages: result.messages.length,
      gallery: result.gallery.length,
      events: result.events.length,
      titles: result.titles.length,
      voiceSeats: result.voice.seats.length,
    });
  }, [
    code,
    result.ready,
    result.notFound,
    result.room?.id,
    result.isMember,
    result.members.length,
    result.moments.length,
    result.messages.length,
    result.gallery.length,
    result.events.length,
    result.titles.length,
    result.voice.seats.length,
  ]);

  useEffect(() => {
    debug('data', 'useRoom mount', { code });
    return () => debug('data', 'useRoom unmount', { code });
  }, [code]);

  return result;
}
