/**
 * Roasts for a room, assembled live.
 *
 * `byMoment` powers the per-moment roast sheet; `leaderboard` is the whole
 * room's roasts ranked by votes for the live standings. Both re-derive on every
 * vote because `roast` and `roast_vote` are ordinary subscribed tables.
 */
import { useMemo } from 'react';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';
import type { Roast, RoomMember } from '../module_bindings/types';

export interface RoastView {
  roast: Roast;
  author: RoomMember | undefined;
  votes: number;
  mine: boolean;
  iVoted: boolean;
}

export interface RoomRoasts {
  ready: boolean;
  byMoment: Map<bigint, RoastView[]>;
  leaderboard: RoastView[];
  totalRoasts: number;
}

export function useRoasts(
  roomId: bigint | undefined,
  members: RoomMember[],
  myMemberId: bigint | undefined
): RoomRoasts {
  const [allRoasts, roastsReady] = useTable(tables.roast);
  const [allVotes, votesReady] = useTable(tables.roastVote);

  return useMemo(() => {
    const ready = roastsReady && votesReady;
    if (roomId === undefined) {
      return { ready, byMoment: new Map(), leaderboard: [], totalRoasts: 0 };
    }

    const byMember = new Map(members.map((m) => [m.id, m]));
    const votesByRoast = new Map<bigint, number>();
    const minePerRoast = new Set<bigint>();
    for (const v of allVotes) {
      votesByRoast.set(v.roastId, (votesByRoast.get(v.roastId) ?? 0) + 1);
      if (myMemberId !== undefined && v.membershipId === myMemberId) minePerRoast.add(v.roastId);
    }

    const roomRoasts = allRoasts
      .filter((r) => r.roomId === roomId)
      .map<RoastView>((roast) => ({
        roast,
        author: byMember.get(roast.authorMembershipId),
        votes: votesByRoast.get(roast.id) ?? 0,
        mine: myMemberId !== undefined && roast.authorMembershipId === myMemberId,
        iVoted: minePerRoast.has(roast.id),
      }));

    const rank = (a: RoastView, b: RoastView) =>
      b.votes - a.votes ||
      Number(a.roast.createdAt.microsSinceUnixEpoch - b.roast.createdAt.microsSinceUnixEpoch);

    const byMoment = new Map<bigint, RoastView[]>();
    for (const rv of roomRoasts) {
      const list = byMoment.get(rv.roast.momentId);
      if (list) list.push(rv);
      else byMoment.set(rv.roast.momentId, [rv]);
    }
    for (const list of byMoment.values()) list.sort(rank);

    return {
      ready,
      byMoment,
      leaderboard: [...roomRoasts].sort(rank),
      totalRoasts: roomRoasts.length,
    };
  }, [roomId, members, myMemberId, allRoasts, allVotes, roastsReady, votesReady]);
}
