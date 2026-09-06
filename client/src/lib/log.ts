/**
 * Connection event logging.
 *
 * Every connect / disconnect / reconnect / error goes through here so the
 * console format is consistent and the last ~50 events are kept in a ring
 * buffer. When a session misbehaves (a stuck loader, a silent drop), run
 * `__chaiConnLog()` in the browser console to see the timeline.
 */

export type ConnLogKind =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnected'
  | 'connection-lost'
  | 'connect-error'
  | 'subscription-applied'
  | 'subscription-error';

const RING: string[] = [];
const MAX = 50;

export function connLog(kind: ConnLogKind, detail?: Record<string, unknown>) {
  const parts = detail
    ? Object.entries(detail)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}=${v}`)
    : [];
  const line = `[chai-time] ${new Date().toISOString()} conn:${kind}${
    parts.length ? ' ' + parts.join(' ') : ''
  }`;

  RING.push(line);
  if (RING.length > MAX) RING.shift();

  const level =
    kind === 'connect-error' || kind === 'subscription-error'
      ? console.error
      : kind === 'connection-lost'
        ? console.warn
        : console.info;
  level(line);
}

/** The recent connection-event timeline, newest last. */
export function connLogHistory(): string[] {
  return [...RING];
}

/* ------------------------------------------------------------------ debug -- */

/**
 * Lightweight instrumentation for tracing a bug: navigation, screen
 * mount/unmount, and what each screen's data hook resolved to. On by default
 * in dev; in a production build set `localStorage.chaiDebug = '1'` (or add
 * `?debug` to the URL) to turn it on, then read `__chaiDebugLog()`.
 */
const DEBUG_RING: string[] = [];
const DEBUG_MAX = 500;

let debugEnabled = false;
try {
  debugEnabled =
    import.meta.env?.DEV === true ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('chaiDebug') === '1') ||
    (typeof location !== 'undefined' && location.search.includes('debug'));
} catch {
  /* storage blocked */
}

let seq = 0;

export function debug(channel: string, message: string, data?: Record<string, unknown>) {
  if (!debugEnabled) return;
  const n = String(++seq).padStart(4, '0');
  const parts = data
    ? Object.entries(data)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    : [];
  const line = `[chai:${channel}] #${n} ${message}${parts.length ? ' | ' + parts.join(' ') : ''}`;
  DEBUG_RING.push(`${performance.now().toFixed(0)}ms ${line}`);
  if (DEBUG_RING.length > DEBUG_MAX) DEBUG_RING.shift();
  // eslint-disable-next-line no-console
  console.debug(line);
}

export function debugLogHistory(): string[] {
  return [...DEBUG_RING];
}

if (typeof window !== 'undefined') {
  const w = window as unknown as {
    __chaiConnLog?: () => string[];
    __chaiDebugLog?: () => string[];
    __chaiDebug?: (on?: boolean) => void;
  };
  w.__chaiConnLog = connLogHistory;
  w.__chaiDebugLog = debugLogHistory;
  w.__chaiDebug = (on = true) => {
    debugEnabled = on;
    try {
      localStorage.setItem('chaiDebug', on ? '1' : '0');
    } catch {
      /* ignore */
    }
  };
}

/* --------------------------------------------------------------- watchdog -- */

/**
 * Main-thread stall detector. A self-scheduling 1s timer: whenever it fires
 * noticeably late *while the tab is foregrounded*, the main thread was blocked
 * (a runaway effect, a re-render storm, a stuck animation frame) — i.e. the
 * "app feels frozen" symptom, timestamped. Hidden-tab throttling is expected
 * and ignored. Runs whenever debug logging is on.
 */
if (typeof window !== 'undefined' && debugEnabled) {
  const BEAT = 1000;
  const STALL = 1800;
  let last = performance.now();
  let worstForeground = 0;
  const tick = () => {
    const now = performance.now();
    const gap = now - last;
    last = now;
    if (!document.hidden && gap > STALL) {
      worstForeground = Math.max(worstForeground, gap);
      debug('watchdog', 'main-thread stall', {
        gapMs: Math.round(gap),
        worstMs: Math.round(worstForeground),
      });
    }
    window.setTimeout(tick, BEAT);
  };
  window.setTimeout(tick, BEAT);

  (window as unknown as { __chaiWatchdog?: () => number }).__chaiWatchdog = () =>
    Math.round(worstForeground);
}
