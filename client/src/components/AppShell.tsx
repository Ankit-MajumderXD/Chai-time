/**
 * The frame every screen lives inside.
 *
 * It owns the phone-width column, the animated screen swap, and the floating
 * bottom navigation — screens themselves never think about any of it.
 */
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomNav } from './Nav';
import { pageVariants, pushVariants } from '../design/motion';
import type { Direction } from '../lib/router';

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-frame">{children}</div>;
}

export function ScreenSwap({
  screenKey,
  direction,
  children,
}: {
  screenKey: string;
  direction: Direction;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={screenKey}
        className="screen-slot"
        variants={direction === 'none' ? pageVariants : pushVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        custom={direction}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function TabBar({
  active,
  onCapture,
}: {
  active: 'rooms' | 'capture' | 'profile';
  onCapture: () => void;
}) {
  return <BottomNav active={active} onCapture={onCapture} />;
}
