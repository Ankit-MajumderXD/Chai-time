/**
 * Presence side-effects.
 *
 * Opening a room tells everyone you're looking at it; leaving, backgrounding
 * the tab or closing it takes that back. The server owns the truth — these are
 * just the writes that keep it honest.
 */
import { useEffect, useRef } from 'react';
import { call, useConn } from './db';
import { debug } from '../lib/log';

const HEARTBEAT_MS = 45_000;

/** Every `pagehide`/`visibilitychange` listener this hook has ever attached —
 *  watched during the freeze hunt to catch listeners that outlive their effect. */
let presenceListeners = 0;

/** Marks me as viewing `roomId` for as long as this component is mounted. */
export function useViewingRoom(roomId: bigint | undefined, enabled: boolean) {
  const conn = useConn();
  const roomKey = roomId !== undefined ? roomId.toString() : '';

  useEffect(() => {
    if (!conn || !enabled || roomId === undefined) return;

    let alive = true;
    const announce = (viewing: boolean) => {
      if (!alive && viewing) return;
      void call(conn.reducers.setViewing({ roomId, viewing }));
    };

    announce(true);

    const onVisibility = () => {
      debug('presence', 'visibilitychange', { hidden: document.hidden, roomKey });
      announce(!document.hidden);
    };
    const onPageHide = () => announce(false);
    const heartbeat = window.setInterval(() => {
      if (!document.hidden) {
        debug('presence', 'heartbeat', { roomKey });
        announce(true);
      }
    }, HEARTBEAT_MS);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    presenceListeners += 2;
    debug('presence', 'mount', { roomKey, presenceListeners });

    return () => {
      alive = false;
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      presenceListeners -= 2;
      debug('presence', 'cleanup', { roomKey, presenceListeners });
      void call(conn.reducers.setViewing({ roomId, viewing: false }));
    };
    // roomKey keeps the effect keyed on the room without a bigint in deps.
  }, [conn, enabled, roomKey]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Debounced "…is typing" ping while someone composes a reply. */
export function useTypingPing(roomId: bigint | undefined) {
  const conn = useConn();
  const lastSent = useRef(0);

  return () => {
    if (!conn || roomId === undefined) return;
    const now = Date.now();
    if (now - lastSent.current < 2500) return;
    lastSent.current = now;
    void call(conn.reducers.setTyping({ roomId }));
  };
}
