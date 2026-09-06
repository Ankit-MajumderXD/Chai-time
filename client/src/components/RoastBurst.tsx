/**
 * The burst that plays when a roast reaction lands.
 *
 * One component, four looks — each `RoastStyle` gets its own particle shape,
 * palette, timing and easing so the four reactions read as genuinely different
 * things, not recolours of one effect. Purely decorative: it mounts, plays
 * once, and the parent unmounts it.
 *
 *   fire  🔥  radial ember/flame trail — intensity scales with heat
 *   devil 😈  red smoke puff rising + a horns-pop wiggle on the badge
 *   skull 💀  hard scale-snap + a sharp shard shatter + white flash
 *   clown 🤡  spring bounce + a confetti pop that flutters down
 */
import { motion } from 'framer-motion';
import { HEATS, ROAST_STYLES, type Heat, type RoastStyle } from '../lib/roastLines';

export function RoastBurst({ style, heat }: { style: RoastStyle; heat: Heat }) {
  switch (style) {
    case 'devil':
      return <DevilBurst heat={heat} />;
    case 'skull':
      return <SkullBurst heat={heat} />;
    case 'clown':
      return <ClownBurst heat={heat} />;
    default:
      return <FireBurst heat={heat} />;
  }
}

/* ------------------------------------------------------------------ fire -- */

export function FireBurst({ heat }: { heat: Heat }) {
  const meta = HEATS[heat];
  const n = meta.embers;
  const spread = heat === 'savage' ? 150 : heat === 'spicy' ? 100 : 64;

  return (
    <span className="roast-burst" style={{ ['--rb-hue' as string]: meta.hue }} aria-hidden>
      <motion.span
        className="roast-burst__core"
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, heat === 'savage' ? 2.4 : 1.6, 0], opacity: [0, 1, 0] }}
        transition={{ duration: heat === 'savage' ? 0.8 : 0.55, ease: 'easeOut' }}
      >
        {meta.flames}
      </motion.span>
      {Array.from({ length: n }).map((_, i) => {
        const angle = (i / n) * Math.PI * 2 + Math.random() * 0.6;
        const dist = spread * (0.55 + Math.random() * 0.55);
        return (
          <motion.span
            key={i}
            className="roast-burst__ember"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist - 20,
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1, 0.7, 0.2],
            }}
            transition={{ duration: 0.6 + Math.random() * 0.5, ease: 'easeOut', delay: Math.random() * 0.12 }}
          />
        );
      })}
    </span>
  );
}

/* ----------------------------------------------------------------- devil -- */

function DevilBurst({ heat }: { heat: Heat }) {
  const puffs = heat === 'savage' ? 5 : heat === 'spicy' ? 4 : 3;
  return (
    <span className="roast-burst" style={{ ['--rb-hue' as string]: ROAST_STYLES.devil.hue }} aria-hidden>
      {/* horns pop up from behind the face, then settle */}
      {[-1, 1].map((dir) => (
        <motion.span
          key={dir}
          className="roast-burst__horn"
          style={{ ['--dir' as string]: dir }}
          initial={{ y: 6, scaleY: 0, opacity: 0 }}
          animate={{ y: [6, -14, -10], scaleY: [0, 1.15, 1], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.6, ease: 'backOut', times: [0, 0.5, 0.75, 1] }}
        />
      ))}
      <motion.span
        className="roast-burst__core"
        initial={{ scale: 0.3, rotate: 0, opacity: 0 }}
        animate={{ scale: [0.3, 1.5, 1.2, 0], rotate: [0, -12, 12, -6, 0], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        {ROAST_STYLES.devil.emoji}
      </motion.span>
      {Array.from({ length: puffs }).map((_, i) => (
        <motion.span
          key={i}
          className="roast-burst__smoke"
          initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
          animate={{
            x: (Math.random() - 0.5) * 44,
            y: -30 - Math.random() * 46,
            scale: [0.3, 1.4 + Math.random() * 0.6],
            opacity: [0, 0.55, 0],
          }}
          transition={{ duration: 0.7 + Math.random() * 0.3, ease: 'easeOut', delay: i * 0.05 }}
        />
      ))}
    </span>
  );
}

/* ----------------------------------------------------------------- skull -- */

function SkullBurst({ heat }: { heat: Heat }) {
  const shards = heat === 'savage' ? 12 : heat === 'spicy' ? 9 : 7;
  const reach = heat === 'savage' ? 120 : 90;
  return (
    <span className="roast-burst" style={{ ['--rb-hue' as string]: ROAST_STYLES.skull.hue }} aria-hidden>
      <motion.span
        className="roast-burst__flash"
        initial={{ scale: 0.2, opacity: 0.9 }}
        animate={{ scale: [0.2, 2.6], opacity: [0.9, 0] }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.span
        className="roast-burst__core"
        initial={{ scale: 0, rotate: -8 }}
        animate={{ scale: [0, 1.35, 1, 0], rotate: [-8, 4, 0, 0], opacity: [1, 1, 1, 0] }}
        transition={{ duration: 0.42, ease: [0.7, 0, 0.3, 1], times: [0, 0.25, 0.5, 1] }}
      >
        {ROAST_STYLES.skull.emoji}
      </motion.span>
      {Array.from({ length: shards }).map((_, i) => {
        const angle = (i / shards) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const dist = reach * (0.7 + Math.random() * 0.4);
        return (
          <motion.span
            key={i}
            className="roast-burst__shard"
            style={{ rotate: `${(angle * 180) / Math.PI}deg` }}
            initial={{ x: 0, y: 0, opacity: 0, scaleX: 0.2 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: [0, 1, 0],
              scaleX: [0.2, 1, 0.4],
            }}
            transition={{ duration: 0.3 + Math.random() * 0.1, ease: [0.2, 0.8, 0.2, 1] }}
          />
        );
      })}
    </span>
  );
}

/* ----------------------------------------------------------------- clown -- */

const CONFETTI = ['#ff5c8a', '#ffd23f', '#4dc9ff', '#7c5cff', '#3ddc84', '#ff8a3d'];

function ClownBurst({ heat }: { heat: Heat }) {
  const bits = heat === 'savage' ? 18 : heat === 'spicy' ? 13 : 9;
  return (
    <span className="roast-burst" style={{ ['--rb-hue' as string]: ROAST_STYLES.clown.hue }} aria-hidden>
      <motion.span
        className="roast-burst__core"
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: [0, 1.3, 0.9, 1.12, 1, 0.6], rotate: [-20, 12, -8, 4, 0, 0], opacity: [1, 1, 1, 1, 1, 0] }}
        transition={{ duration: 0.85, ease: 'easeOut', times: [0, 0.2, 0.4, 0.6, 0.8, 1] }}
      >
        {ROAST_STYLES.clown.emoji}
      </motion.span>
      {Array.from({ length: bits }).map((_, i) => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
        const dist = 40 + Math.random() * 70;
        const round = i % 3 === 0;
        return (
          <motion.span
            key={i}
            className={`roast-burst__confetti${round ? ' is-round' : ''}`}
            style={{ background: CONFETTI[i % CONFETTI.length] }}
            initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: [0, Math.sin(angle) * dist, Math.sin(angle) * dist + 60 + Math.random() * 30],
              opacity: [0, 1, 1, 0],
              rotate: (Math.random() - 0.5) * 540,
            }}
            transition={{ duration: 0.8 + Math.random() * 0.4, ease: 'easeOut', delay: Math.random() * 0.1, times: [0, 0.35, 0.7, 1] }}
          />
        );
      })}
    </span>
  );
}
