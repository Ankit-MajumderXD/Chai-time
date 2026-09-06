/**
 * "Replay the room" — reconstruct what happened while you were away.
 *
 * Everything comes from tables the room screen already subscribes to
 * (`room_event`, `moment`, `reaction`, `room_member`). We merge them into one
 * time-ordered list of beats, then peel the most recent cluster of moments off
 * the end — that becomes the collision finale.
 */
import { useMemo } from 'react';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';
import type { RoomMember } from '../module_bindings/types';
import type { MomentView, RoomView } from './useRoom';
import { toMillis } from '../lib/format';

export type BeatKind =
  | 'online'
  | 'joined'
  | 'moment'
  | 'reaction'
  | 'voice'
  | 'prompt'
  | 'now';

export interface ReplayBeat {
  id: string;
  atMillis: number;
  kind: BeatKind;
  member: RoomMember | undefined;
  text: string;
  moment?: MomentView;
  emoji?: string;
}

export interface ReplayData {
  /** True when there's something worth replaying since the last catch-up. */
  hasReplay: boolean;
  /** How many beats are new since the last catch-up (drives the button badge). */
  unseen: number;
  sinceMillis: number;
  story: ReplayBeat[];
  /** The moments that all landed in the final window — the collision. */
  collision: MomentView[];
}

/** When the member has never caught up, replay the last ~quarter hour — the
 *  story of "what I just missed", not this morning. Once they've caught up
 *  once, `lastReplayMicros` is the real boundary. */
const DEFAULT_LOOKBACK_MS = 16 * 60 * 1000;
const COLLISION_WINDOW_MS = 4.5 * 60 * 1000;
const MIN_COLLISION = 2;
const MAX_COLLISION = 5;
const MAX_STORY_BEATS = 11;

export function useReplay(room: RoomView): ReplayData {
  const [allReactions] = useTable(tables.reaction);

  return useMemo(() => {
    const now = Date.now();
    const lastReplay = room.me ? Number(room.me.lastReplayMicros / 1000n) : 0;
    const since = lastReplay > 0 ? lastReplay : now - DEFAULT_LOOKBACK_MS;

    if (!room.room) {
      return { hasReplay: false, unseen: 0, sinceMillis: since, story: [], collision: [] };
    }

    const memberById = new Map(room.members.map((m) => [m.id, m]));

    // ---- the collision: the last tight cluster of moments -------------------
    const momentsNewestFirst = [...room.moments].sort(
      (a, b) => toMillis(b.moment.createdAt) - toMillis(a.moment.createdAt)
    );
    let collision: MomentView[] = [];
    if (momentsNewestFirst.length > 0) {
      const newest = toMillis(momentsNewestFirst[0].moment.createdAt);
      collision = momentsNewestFirst
        .filter((v) => newest - toMillis(v.moment.createdAt) <= COLLISION_WINDOW_MS)
        .slice(0, MAX_COLLISION);
      if (collision.length < MIN_COLLISION) {
        collision = momentsNewestFirst.slice(0, Math.min(MIN_COLLISION, momentsNewestFirst.length));
      }
    }
    const collisionIds = new Set(collision.map((v) => String(v.moment.id)));
    const collisionStart = collision.length
      ? Math.min(...collision.map((v) => toMillis(v.moment.createdAt)))
      : now;

    // ---- the story: everything before the collision ------------------------
    const beats: ReplayBeat[] = [];

    for (const e of room.events) {
      const at = toMillis(e.createdAt);
      if (at < since || at >= collisionStart) continue;
      const member = memberById.get(e.memberId);
      if (e.kind === 'online') {
        beats.push({ id: `e${e.id}`, atMillis: at, kind: 'online', member, text: e.text || `${member?.displayName ?? 'Someone'} came online` });
      } else if (e.kind === 'joined' || e.kind === 'created') {
        beats.push({ id: `e${e.id}`, atMillis: at, kind: 'joined', member, text: e.text });
      } else if (e.kind === 'voice_started') {
        beats.push({ id: `e${e.id}`, atMillis: at, kind: 'voice', member, text: e.text });
      } else if (e.kind === 'prompt') {
        beats.push({ id: `e${e.id}`, atMillis: at, kind: 'prompt', member, text: e.text });
      } else if (e.kind === 'reacted') {
        const m = e.text.match(/(\p{Emoji})\s*$/u);
        beats.push({ id: `e${e.id}`, atMillis: at, kind: 'reaction', member, text: e.text, emoji: m?.[1] });
      }
    }

    for (const view of room.moments) {
      if (collisionIds.has(String(view.moment.id))) continue;
      const at = toMillis(view.moment.createdAt);
      if (at < since) continue;
      beats.push({
        id: `m${view.moment.id}`,
        atMillis: at,
        kind: 'moment',
        member: memberById.get(view.moment.memberId),
        text:
          view.moment.kind === 'voice'
            ? `${view.author?.displayName ?? 'Someone'} sent a voice note`
            : `${view.author?.displayName ?? 'Someone'} shared a moment`,
        moment: view,
      });
    }

    // Reactions straight off the table (real ones don't log a room_event).
    for (const r of allReactions) {
      const at = toMillis(r.createdAt);
      if (at < since || at >= collisionStart) continue;
      const view = room.moments.find((v) => v.moment.id === r.momentId);
      if (!view || collisionIds.has(String(r.momentId))) continue;
      const member = memberById.get(r.memberId);
      if (!member) continue;
      // skip if we already have a scripted 'reacted' beat at ~this time
      if (beats.some((b) => b.kind === 'reaction' && Math.abs(b.atMillis - at) < 30_000 && b.member?.id === member.id)) {
        continue;
      }
      beats.push({
        id: `r${r.id}`,
        atMillis: at,
        kind: 'reaction',
        member,
        text: `${member.displayName} reacted ${r.emoji}`,
        emoji: r.emoji,
      });
    }

    beats.sort((a, b) => a.atMillis - b.atMillis);

    // Keep it watchable — if a lot happened, tell the most recent chapter.
    const story = beats.length > MAX_STORY_BEATS ? beats.slice(-MAX_STORY_BEATS) : beats;
    const unseen =
      story.filter((b) => b.atMillis >= lastReplay).length +
      collision.filter((v) => toMillis(v.moment.createdAt) >= lastReplay).length;

    return {
      hasReplay: story.length + collision.length >= 2,
      unseen,
      sinceMillis: since,
      story,
      collision,
    };
  }, [room.room, room.me, room.members, room.moments, room.events, allReactions]);
}
