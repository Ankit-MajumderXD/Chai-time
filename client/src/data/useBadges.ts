/**
 * My badges — everything I've earned across every room — plus a queue of the
 * ones that landed *while I was looking*, so the app can throw a little party
 * rather than let an achievement slip by as a silent row insert.
 *
 * The "seen" set is seeded from whatever badges already exist on the first
 * render, exactly like `useLiveEvents` in the room: history is not news.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';
import type { Badge } from '../module_bindings/types';
import { badgeMeta, type BadgeMeta } from '../lib/badges';
import { useSession } from './useSession';

export interface EarnedBadge {
  badge: Badge;
  meta: BadgeMeta;
  atMillis: number;
}

export function useMyBadges() {
  const { myPersonId } = useSession();
  const [allBadges, ready] = useTable(tables.badge);
  const [allMembers] = useTable(tables.roomMember);

  const myMemberIds = useMemo(() => {
    if (myPersonId === null) return new Set<bigint>();
    return new Set(
      allMembers.filter((m) => m.personId === myPersonId).map((m) => m.id)
    );
  }, [allMembers, myPersonId]);

  const earned = useMemo<EarnedBadge[]>(() => {
    const seen = new Map<string, EarnedBadge>();
    for (const badge of allBadges) {
      if (!myMemberIds.has(badge.membershipId)) continue;
      const meta = badgeMeta(badge.badgeType);
      if (!meta) continue;
      // One entry per badge *type* — earning "week on fire" in three rooms is
      // still one badge on the shelf, dated to the first time.
      const atMillis = Number(badge.awardedAt.microsSinceUnixEpoch / 1000n);
      const prior = seen.get(badge.badgeType);
      if (!prior || atMillis < prior.atMillis) seen.set(badge.badgeType, { badge, meta, atMillis });
    }
    return [...seen.values()].sort((a, b) => b.atMillis - a.atMillis);
  }, [allBadges, myMemberIds]);

  // ---- newly-unlocked queue -------------------------------------------------
  const [queue, setQueue] = useState<EarnedBadge[]>([]);
  const seenTypes = useRef<Set<string> | null>(null);

  useEffect(() => {
    const mineNow = allBadges.filter((b) => myMemberIds.has(b.membershipId));
    if (seenTypes.current === null) {
      seenTypes.current = new Set(mineNow.map((b) => b.badgeType));
      return;
    }
    for (const badge of mineNow) {
      if (seenTypes.current.has(badge.badgeType)) continue;
      seenTypes.current.add(badge.badgeType);
      const meta = badgeMeta(badge.badgeType);
      if (!meta) continue;
      setQueue((q) => [
        ...q,
        { badge, meta, atMillis: Number(badge.awardedAt.microsSinceUnixEpoch / 1000n) },
      ]);
    }
  }, [allBadges, myMemberIds]);

  const dismissFirst = () => setQueue((q) => q.slice(1));

  return { ready, earned, unlock: queue[0], dismissUnlock: dismissFirst };
}
