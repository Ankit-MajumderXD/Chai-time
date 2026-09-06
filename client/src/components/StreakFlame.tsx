/**
 * The streak flame.
 *
 * Three tiers, each a real visual step rather than a tint:
 *   1–6    an ember — small, warm, still
 *   7–29   alight — bigger, orange-red, a slow flicker
 *   30+    white-hot — a blue-white core, a firmer pulse
 *
 * The number counts up when the streak grows; it never snaps.
 */
import { memo } from 'react';
import { motion } from 'framer-motion';
import { spring } from '../design/motion';
import { useCountUp } from '../lib/useCountUp';

type Tier = 'ember' | 'lit' | 'blaze';

function tierOf(count: number): Tier {
  if (count >= 30) return 'blaze';
  if (count >= 7) return 'lit';
  return 'ember';
}

const PALETTE: Record<Tier, { core: string; edge: string; glow: string }> = {
  ember: { core: '#ffb347', edge: '#ff7a3d', glow: 'rgba(255,138,61,0.28)' },
  lit: { core: '#ffd24a', edge: '#ff4d3d', glow: 'rgba(255,90,61,0.42)' },
  blaze: { core: '#eaf3ff', edge: '#5aa0ff', glow: 'rgba(110,168,255,0.55)' },
};

interface Props {
  count: number;
  /** Longest streak, shown as a faint "best" when it beats the current one. */
  best?: number;
  size?: number;
  showLabel?: boolean;
  className?: string;
}

export const StreakFlame = memo(function StreakFlame({
  count,
  best,
  size = 22,
  showLabel = false,
  className,
}: Props) {
  const shown = useCountUp(count);
  const tier = tierOf(count);
  const c = PALETTE[tier];

  const flicker =
    tier === 'ember'
      ? { scale: [1, 1.03, 1], rotate: 0 }
      : tier === 'lit'
        ? { scale: [1, 1.09, 0.98, 1.05, 1], rotate: [0, -2, 1.5, -1, 0] }
        : { scale: [1, 1.14, 0.97, 1.08, 1], rotate: [0, 2.5, -2, 1, 0] };

  const period = tier === 'ember' ? 3.4 : tier === 'lit' ? 1.9 : 1.3;

  return (
    <span
      className={`streak-flame streak-flame--${tier}${className ? ' ' + className : ''}`}
      style={{ ['--flame-glow' as string]: c.glow }}
      title={
        best && best > count
          ? `${count}-day streak · best ${best}`
          : `${count}-day streak`
      }
    >
      <motion.span
        className="streak-flame__icon"
        style={{ width: size, height: size }}
        animate={flicker}
        transition={{ duration: period, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
          <defs>
            <radialGradient id={`fl-${tier}`} cx="50%" cy="68%" r="62%">
              <stop offset="0%" stopColor={c.core} />
              <stop offset="100%" stopColor={c.edge} />
            </radialGradient>
          </defs>
          <path
            d="M13.5 2.2c.4 3-1.2 4.6-2.7 6.1C9 10.2 7.4 12 7.4 14.7a6.6 6.6 0 0 0 13.2.3c0-2.6-1.2-4.4-2.3-6-.3 1-1 1.8-1.9 2.2.6-2.6-.1-5.8-2.9-9Z"
            fill={`url(#fl-${tier})`}
          />
          {tier !== 'ember' && (
            <path
              d="M12.6 12c.3 1.6-.7 2.4-.7 3.8a2.2 2.2 0 0 0 4.4.1c0-1.3-.7-2-1.3-2.8-.2.5-.5.8-1 1 .3-1.2 0-1.9-.4-2.1Z"
              fill={c.core}
              opacity={0.9}
            />
          )}
        </svg>
      </motion.span>

      <motion.span
        className="streak-flame__count"
        key={count > 0 ? 'has' : 'zero'}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring.pop}
      >
        {shown}
      </motion.span>

      {showLabel && <span className="streak-flame__label">day{count === 1 ? '' : 's'}</span>}
    </span>
  );
});
