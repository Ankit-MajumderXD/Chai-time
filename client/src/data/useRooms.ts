/**
 * The Rooms screen's data: every room I belong to, sorted by whatever happened
 * most recently, plus "your people" — everyone I share a room with.
 */
import { useMemo } from 'react';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';
import type { Media, Moment, Room, RoomMember } from '../module_bindings/types';
import { useSession } from './useSession';

export interface RoomSummary {
  room: Room;
  members: RoomMember[];
  others: RoomMember[];
  activeCount: number;
  me: RoomMember | undefined;
  latest: Moment | undefined;
  latestAuthor: RoomMember | undefined;
  /** Cover for the card: the newest shared image, if there is one. */
  latestMediaUrl: string;
  momentCount: number;
}

export interface RoomsData {
  ready: boolean;
  rooms: RoomSummary[];
  /** Distinct people across all my rooms, most-recently-seen first. */
  people: RoomMember[];
  totalMoments: number;
}

export function isActiveMember(m: RoomMember): boolean {
  return m.status === 'online' || m.status === 'away';
}

export function useRooms(): RoomsData {
  const { myPersonId, ready: sessionReady } = useSession();
  const [rooms, roomsReady] = useTable(tables.room);
  const [members, membersReady] = useTable(tables.roomMember);
  const [moments, momentsReady] = useTable(tables.moment);
  const [allMedia] = useTable(tables.media);

  return useMemo(() => {
    const ready = sessionReady && roomsReady && membersReady && momentsReady;
    if (myPersonId === null) {
      return { ready, rooms: [], people: [], totalMoments: 0 };
    }

    const mine = new Set(
      members.filter((m) => m.personId === myPersonId).map((m) => m.roomId)
    );

    const byRoom = new Map<bigint, RoomMember[]>();
    for (const m of members) {
      if (!mine.has(m.roomId)) continue;
      const list = byRoom.get(m.roomId);
      if (list) list.push(m);
      else byRoom.set(m.roomId, [m]);
    }

    const mediaById = new Map<bigint, Media>();
    for (const item of allMedia) mediaById.set(item.id, item);

    const momentsByRoom = new Map<bigint, Moment[]>();
    for (const moment of moments) {
      if (!mine.has(moment.roomId)) continue;
      const list = momentsByRoom.get(moment.roomId);
      if (list) list.push(moment);
      else momentsByRoom.set(moment.roomId, [moment]);
    }

    const summaries: RoomSummary[] = rooms
      .filter((r) => mine.has(r.id))
      .map((room) => {
        const roomMembers = byRoom.get(room.id) ?? [];
        // Auto-increment ids are not ordered — always sort by time.
        const roomMoments = [...(momentsByRoom.get(room.id) ?? [])].sort(
          (a, b) =>
            Number(
              b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch
            )
        );
        const latest = roomMoments[0];
        // The card shows a still. A voice moment has none; a video has one only
        // if a poster frame was captured at upload — so fall back to the newest
        // moment that actually has something to show.
        const stillFor = (m: Moment) => {
          const item = mediaById.get(m.mediaId);
          if (!item || item.kind === 'voice') return '';
          return item.kind === 'video' ? item.posterUrl : item.url;
        };
        const withPicture = roomMoments.find((m) => !!stillFor(m));
        const me = roomMembers.find((m) => m.personId === myPersonId);
        return {
          room,
          members: roomMembers,
          others: roomMembers.filter((m) => m.personId !== myPersonId),
          activeCount: roomMembers.filter((m) => m.status === 'online').length,
          me,
          latest,
          latestAuthor: latest
            ? roomMembers.find((m) => m.id === latest.memberId)
            : undefined,
          latestMediaUrl: withPicture ? stillFor(withPicture) : '',
          momentCount: roomMoments.length,
        };
      })
      .sort((a, b) => {
        const at = a.latest?.createdAt ?? a.room.lastActivityAt;
        const bt = b.latest?.createdAt ?? b.room.lastActivityAt;
        return Number(bt.microsSinceUnixEpoch - at.microsSinceUnixEpoch);
      });

    // "Your people": one row per human, best presence wins, online first.
    const rank = (s: string) => (s === 'online' ? 0 : s === 'away' ? 1 : 2);
    const peopleByName = new Map<string, RoomMember>();
    for (const summary of summaries) {
      for (const member of summary.others) {
        const key = `${member.displayName}|${member.avatarUrl}`;
        const existing = peopleByName.get(key);
        if (!existing || rank(member.status) < rank(existing.status)) {
          peopleByName.set(key, member);
        }
      }
    }
    const people = [...peopleByName.values()].sort(
      (a, b) =>
        rank(a.status) - rank(b.status) ||
        Number(b.lastSeenAt.microsSinceUnixEpoch - a.lastSeenAt.microsSinceUnixEpoch)
    );

    return {
      ready,
      rooms: summaries,
      people,
      totalMoments: summaries.reduce((sum, s) => sum + s.momentCount, 0),
    };
  }, [
    myPersonId,
    sessionReady,
    rooms,
    roomsReady,
    members,
    membersReady,
    moments,
    momentsReady,
    allMedia,
  ]);
}
