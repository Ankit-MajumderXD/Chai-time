/**
 * A room's prompt state: the one currently live, its schedule, and the room's
 * own custom prompts. All from subscribed tables.
 */
import { useMemo } from 'react';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';
import type { CustomPrompt, RoomPrompt, RoomPromptSchedule } from '../module_bindings/types';

export interface RoomPromptState {
  live: RoomPrompt | undefined;
  /** All of the room's daily prompt slots, earliest first. */
  schedules: RoomPromptSchedule[];
  customPrompts: CustomPrompt[];
  activeCustom: CustomPrompt | undefined;
}

const hhmm = (s: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};

export function useRoomPrompt(roomId: bigint | undefined): RoomPromptState {
  const [prompts] = useTable(tables.roomPrompt);
  const [scheduleRows] = useTable(tables.roomPromptSchedule);
  const [customs] = useTable(tables.customPrompt);

  return useMemo(() => {
    if (roomId === undefined) {
      return { live: undefined, schedules: [], customPrompts: [], activeCustom: undefined };
    }
    const customPrompts = customs
      .filter((c) => c.roomId === roomId)
      .sort((a, b) =>
        Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
      );
    return {
      live: prompts.find((p) => p.roomId === roomId),
      schedules: scheduleRows
        .filter((s) => s.roomId === roomId)
        .sort((a, b) => hhmm(a.scheduledTime) - hhmm(b.scheduledTime)),
      customPrompts,
      activeCustom: customPrompts.find((c) => c.active),
    };
  }, [roomId, prompts, scheduleRows, customs]);
}

/* ---- local-time <-> UTC "HH:MM" for the schedule picker ---- */

export function localToUtcHHMM(local: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(local.trim());
  if (!m) return local;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function utcToLocalHHMM(utc: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(utc.trim());
  if (!m) return utc;
  const d = new Date();
  d.setUTCHours(Number(m[1]), Number(m[2]), 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
