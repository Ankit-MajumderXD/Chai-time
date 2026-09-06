/**
 * The emoji picker — a full keyboard-searchable set, lazily loaded so it never
 * costs anything on first paint.
 *
 * It renders into a portal with fixed positioning anchored to its trigger, so
 * it escapes any `overflow: hidden` ancestor (the composer bar, a bottom sheet)
 * and never gets clipped. `emoji-picker-react` in NATIVE mode renders plain
 * unicode glyphs — no sprite sheet, no network — matching the rest of the app.
 */
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { EmojiStyle, Theme } from 'emoji-picker-react';
import { duration, spring } from '../design/motion';

// `import type` is erased at build time and the enum *values* are just their
// string names, so this keeps the whole picker behind the dynamic import.
const NATIVE = 'native' as EmojiStyle;
const AUTO = 'auto' as Theme;

const Picker = lazy(() => import('emoji-picker-react'));

const PANEL_W = 316;
const PANEL_H = 380;

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  /** Which edge of the panel lines up with the trigger. */
  align?: 'left' | 'right' | 'center';
}

export function EmojiPopover({ open, onClose, onPick, align = 'left' }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // The trigger is whatever element hosts this popover in the tree.
  const probeRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    setAnchor(probeRef.current?.parentElement ?? null);
  }, []);

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const margin = 8;
      let left =
        align === 'right'
          ? r.right - PANEL_W
          : align === 'center'
            ? r.left + r.width / 2 - PANEL_W / 2
            : r.left;
      left = Math.max(margin, Math.min(left, window.innerWidth - PANEL_W - margin));
      // Prefer above the trigger; fall back to below if there isn't room.
      let top = r.top - PANEL_H - 10;
      if (top < margin) top = Math.min(r.bottom + 10, window.innerHeight - PANEL_H - margin);
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor, align]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchor?.contains(t)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    const id = window.setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open, onClose, anchor]);

  return (
    <>
      {/* Zero-size probe: its parent is the trigger we anchor to. */}
      <span ref={probeRef} aria-hidden style={{ display: 'none' }} />
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              className="emoji-pop"
              style={{ top: pos.top, left: pos.left }}
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6, transition: { duration: duration.fast } }}
              transition={spring.bouncy}
              role="dialog"
              aria-label="Choose an emoji"
            >
              <Suspense fallback={<div className="emoji-pop__loading">Loading emoji…</div>}>
                <Picker
                  onEmojiClick={(e) => {
                    onPick(e.emoji);
                    onClose();
                  }}
                  emojiStyle={NATIVE}
                  theme={AUTO}
                  width={PANEL_W}
                  height={PANEL_H}
                  lazyLoadEmojis
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
                  searchPlaceholder="Search"
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
