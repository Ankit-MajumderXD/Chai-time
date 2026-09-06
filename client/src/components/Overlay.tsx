/**
 * Bottom sheet and modal.
 *
 * Both spring in, both dim what's behind them, and both close on backdrop tap,
 * Escape, or (for the sheet) a downward drag — the three gestures people
 * already try.
 */
import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { duration, spring } from '../design/motion';

interface BaseProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label?: string;
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

export function BottomSheet({ open, onClose, children, label }: BaseProps) {
  useEscape(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <div className="overlay-root">
          <motion.div
            className="overlay-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast }}
            onClick={onClose}
          />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { duration: duration.base } }}
            transition={spring.bouncy}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 620) onClose();
            }}
          >
            <span className="sheet__grip" aria-hidden />
            <div className="sheet__body">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Modal({ open, onClose, children, label }: BaseProps) {
  useEscape(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <div className="overlay-root overlay-root--center">
          <motion.div
            className="overlay-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast }}
            onClick={onClose}
          />
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8, transition: { duration: duration.fast } }}
            transition={spring.bouncy}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
