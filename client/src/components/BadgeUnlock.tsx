/**
 * Badge unlock — the moment an achievement lands.
 *
 * A dimmed backdrop, a spring-in medallion, a ring of particles thrown outward
 * in the badge's colour, and a line of copy. Tap anywhere (or wait) to dismiss.
 * Mounted once, high in the tree, so an unlock can fire on any screen.
 */
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { haptic } from '../lib/haptics';
import { duration, spring } from '../design/motion';
import { useMyBadges } from '../data/useBadges';

const PARTICLES = 18;

export function BadgeUnlockHost() {
  const { unlock, dismissUnlock } = useMyBadges();

  useEffect(() => {
    if (!unlock) return;
    haptic('success');
    const t = window.setTimeout(dismissUnlock, 4200);
    return () => window.clearTimeout(t);
  }, [unlock, dismissUnlock]);

  return (
    <AnimatePresence>
      {unlock && (
        <motion.div
          className="badge-unlock"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.fast }}
          onClick={dismissUnlock}
          role="dialog"
          aria-label={`Badge unlocked: ${unlock.meta.label}`}
          style={{ ['--badge-hue' as string]: unlock.meta.hue }}
        >
          <div className="badge-unlock__stage">
            {Array.from({ length: PARTICLES }).map((_, i) => {
              const angle = (i / PARTICLES) * Math.PI * 2;
              const dist = 120 + (i % 3) * 26;
              return (
                <motion.span
                  key={i}
                  className="badge-unlock__particle"
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                  animate={{
                    x: Math.cos(angle) * dist,
                    y: Math.sin(angle) * dist,
                    opacity: [0, 1, 1, 0],
                    scale: [0.4, 1, 0.9, 0.3],
                  }}
                  transition={{ duration: 1.1, ease: 'easeOut', times: [0, 0.2, 0.6, 1], delay: 0.06 }}
                />
              );
            })}

            <motion.div
              className="badge-unlock__medallion"
              initial={{ scale: 0.2, rotate: -28, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ ...spring.pop, delay: 0.05 }}
            >
              <motion.span
                className="badge-unlock__glyph"
                animate={{ rotate: [0, -6, 6, -3, 0] }}
                transition={{ duration: 0.7, delay: 0.3 }}
              >
                {unlock.meta.emoji}
              </motion.span>
            </motion.div>

            <motion.div
              className="badge-unlock__copy"
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...spring.gentle, delay: 0.22 }}
            >
              <p className="badge-unlock__kicker">Badge unlocked</p>
              <p className="badge-unlock__title">{unlock.meta.label}</p>
              <p className="badge-unlock__blurb">{unlock.meta.blurb}</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
