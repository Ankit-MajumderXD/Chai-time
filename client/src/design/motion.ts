/**
 * Motion tokens.
 *
 * One rule runs through all of it: fast, springy, and small. Nothing in the app
 * takes longer than ~380ms, and anything the finger touches answers in <150ms.
 */
import type { Transition, Variants } from 'framer-motion';

export const spring = {
  /** Buttons, chips, presence dots — snappy, barely any overshoot. */
  snappy: { type: 'spring', stiffness: 620, damping: 34, mass: 0.6 },
  /** Cards and list items entering. */
  gentle: { type: 'spring', stiffness: 380, damping: 32, mass: 0.9 },
  /** Sheets, modals, the camera — a touch of bounce so it feels physical. */
  bouncy: { type: 'spring', stiffness: 420, damping: 30, mass: 0.8 },
  /** Reaction pops and celebratory bits. */
  pop: { type: 'spring', stiffness: 700, damping: 18, mass: 0.5 },
} satisfies Record<string, Transition>;

export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

export const duration = {
  instant: 0.09,
  fast: 0.15,
  base: 0.23,
  slow: 0.38,
} as const;

/** Screen transition: soft fade with a whisper of vertical travel. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 10, scale: 0.994 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: duration.base, ease: ease.out },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.996,
    transition: { duration: duration.fast, ease: ease.out },
  },
};

/** Room switching / drill-down: horizontal push. */
export const pushVariants: Variants = {
  initial: { opacity: 0, x: 26 },
  animate: { opacity: 1, x: 0, transition: { duration: duration.base, ease: ease.out } },
  exit: { opacity: 0, x: -18, transition: { duration: duration.fast, ease: ease.out } },
};

/** Full-screen surfaces that come up from the bottom (camera, preview). */
export const riseVariants: Variants = {
  initial: { opacity: 0, y: '4%', scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: spring.bouncy },
  exit: { opacity: 0, y: '3%', scale: 0.99, transition: { duration: duration.fast } },
};

/** Stagger container for feeds and lists. */
export const listVariants: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.055, delayChildren: 0.03 } },
};

/** A new moment arriving: fade + slight upward movement. */
export const itemVariants: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: spring.gentle },
  exit: { opacity: 0, y: -8, transition: { duration: duration.fast } },
};

/**
 * Slow indigo→warm-pastel background drift for splash / loading / hero
 * surfaces. Put it on a layer painted with `--grad-ambient` at
 * `--grad-ambient-size`; the pure-CSS equivalent is the `.bg-ambient` utility
 * in base.css. One loop ≈ 11s — a drift, never a pulse.
 */
export const ambientDrift: Variants = {
  animate: {
    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
    transition: { duration: 11, ease: ease.inOut, repeat: Infinity },
  },
};

/** Press feedback shared by every tactile surface. */
export const pressable = {
  whileTap: { scale: 0.97 },
  transition: spring.snappy,
} as const;

export const pressableCard = {
  whileTap: { scale: 0.985 },
  transition: spring.snappy,
} as const;

export const shutterPress = {
  whileTap: { scale: 0.88 },
  transition: spring.pop,
} as const;
