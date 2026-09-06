/**
 * Roast reactions for a room, assembled per moment.
 *
 * Each moment gets: the list of who roasted it (with their line, heat and
 * style), the total count, a per-style tally for the badge (🔥×2 😈×1), which
 * styles are present, and my own reaction if I have one. All live —
 * `roast_reaction` and `roast_line_library` are subscribed tables.
 */
import { useMemo } from 'react';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';
import type { RoomMember } from '../module_bindings/types';
import { heatRank, ROAST_STYLE_ORDER, type Heat, type RoastStyle } from '../lib/roastLines';

export interface RoastReactionView {
  id: bigint;
  member: RoomMember | undefined;
  text: string;
  heat: Heat;
  style: RoastStyle;
  mine: boolean;
}

export interface StyleTally {
  style: RoastStyle;
  count: number;
}

export interface MomentRoastReactions {
  list: RoastReactionView[];
  count: number;
  /** Per-style counts, in `fire → devil → skull → clown` order — drives the badge. */
  byStyle: StyleTally[];
  styles: RoastStyle[];
  /** true when all four styles are represented — earns the flare. */
  allStyles: boolean;
  mine: RoastReactionView | undefined;
}

const EMPTY: MomentRoastReactions = {
  list: [],
  count: 0,
  byStyle: [],
  styles: [],
  allStyles: false,
  mine: undefined,
};

const asStyle = (s: string): RoastStyle =>
  (ROAST_STYLE_ORDER as string[]).includes(s) ? (s as RoastStyle) : 'fire';

export function useRoastReactions(
  members: RoomMember[],
  myMemberId: bigint | undefined
) {
  const [allReactions] = useTable(tables.roastReaction);
  const [lines] = useTable(tables.roastLineLibrary);

  return useMemo(() => {
    const byMember = new Map(members.map((m) => [m.id, m]));
    const lineText = new Map(lines.map((l) => [l.id, l.text]));

    const byMoment = new Map<bigint, MomentRoastReactions>();
    for (const r of allReactions) {
      const view: RoastReactionView = {
        id: r.id,
        member: byMember.get(r.membershipId),
        text: r.lineId === 0n ? r.customText : (lineText.get(r.lineId) ?? '🔥'),
        heat: (r.heatLevel as Heat) ?? 'mild',
        style: asStyle(r.style),
        mine: myMemberId !== undefined && r.membershipId === myMemberId,
      };
      const cur =
        byMoment.get(r.momentId) ??
        ({
          list: [],
          count: 0,
          byStyle: [],
          styles: [],
          allStyles: false,
          mine: undefined,
        } as MomentRoastReactions);
      cur.list.push(view);
      cur.count += 1;
      if (view.mine) cur.mine = view;
      byMoment.set(r.momentId, cur);
    }

    for (const v of byMoment.values()) {
      v.list.sort((a, b) => heatRank(b.heat) - heatRank(a.heat));
      const counts = new Map<RoastStyle, number>();
      for (const rr of v.list) counts.set(rr.style, (counts.get(rr.style) ?? 0) + 1);
      v.byStyle = ROAST_STYLE_ORDER.filter((s) => counts.has(s)).map((style) => ({
        style,
        count: counts.get(style)!,
      }));
      v.styles = v.byStyle.map((s) => s.style);
      v.allStyles = v.byStyle.length === ROAST_STYLE_ORDER.length;
    }

    return {
      forMoment: (momentId: bigint): MomentRoastReactions => byMoment.get(momentId) ?? EMPTY,
    };
  }, [allReactions, lines, members, myMemberId]);
}
