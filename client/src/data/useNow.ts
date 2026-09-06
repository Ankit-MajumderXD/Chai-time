/**
 * A shared ticking clock for anything that ages on its own — "2 min ago",
 * typing indicators, presence decay.
 *
 * This is a clock, not a poll: no data is fetched here. Every subscriber on the
 * same interval shares one timer, and the timer stops while the tab is hidden.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { debug } from '../lib/log';

type Listener = () => void;

const clocks = new Map<number, { value: number; listeners: Set<Listener>; timer: number }>();

function clockFor(intervalMs: number) {
  let clock = clocks.get(intervalMs);
  if (clock) return clock;

  clock = { value: Date.now(), listeners: new Set(), timer: 0 };
  clocks.set(intervalMs, clock);
  return clock;
}

function subscribe(intervalMs: number, listener: Listener) {
  const clock = clockFor(intervalMs);
  clock.listeners.add(listener);

  if (clock.timer === 0) {
    debug('clock', 'start', { intervalMs, clocks: clocks.size });
    let lastTick = Date.now();
    clock.timer = window.setInterval(() => {
      if (document.hidden) return;
      const nowMs = Date.now();
      const gap = nowMs - lastTick;
      lastTick = nowMs;
      // A foreground tick that lands many intervals late = the timer was
      // starved (main thread blocked, or resuming from background throttle).
      if (gap > intervalMs * 4) {
        debug('clock', 'late tick', { intervalMs, gapMs: gap, listeners: clock.listeners.size });
      }
      clock.value = nowMs;
      clock.listeners.forEach((fn) => fn());
    }, intervalMs);
  }

  return () => {
    clock.listeners.delete(listener);
    if (clock.listeners.size === 0) {
      window.clearInterval(clock.timer);
      clock.timer = 0;
      debug('clock', 'stop', { intervalMs, clocks: clocks.size });
    }
  };
}

export function useNow(intervalMs = 30_000): number {
  return useSyncExternalStore(
    (listener) => subscribe(intervalMs, listener),
    () => clockFor(intervalMs).value,
    () => clockFor(intervalMs).value
  );
}

/** Fires once, after `delayMs`. Handy for staged reveals. */
export function useDelayedFlag(delayMs: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setOn(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);
  return on;
}
