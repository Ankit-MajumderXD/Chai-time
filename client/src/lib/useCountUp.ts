/**
 * Animate a number toward a target instead of snapping to it. Used wherever a
 * count changes under the user's eye — streaks, roast votes.
 */
import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, durationMs = 520): number {
  const [display, setDisplay] = useState(target);
  const from = useRef(target);
  const raf = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = target;
    if (a === b) {
      setDisplay(b);
      return;
    }
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(a + (b - a) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, durationMs]);

  return display;
}
