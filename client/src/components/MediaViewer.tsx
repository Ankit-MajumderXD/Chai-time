/**
 * The full-screen viewer.
 *
 * The one place in the app that goes dark, because the photograph should be the
 * only thing on screen. Swipe or arrow between items; react without leaving.
 */
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { VoiceNote } from './VoiceNote';
import { duration, pressable, spring } from '../design/motion';
import { timeAgo } from '../lib/format';
import { QUICK_REACTIONS } from '../lib/rooms';
import { haptic } from '../lib/haptics';
import { useNow } from '../data/useNow';
import type { Media } from '../module_bindings/types';
import type { ReactionTally } from '../data/useRoom';

export interface ViewerItem {
  key: string;
  media: Media;
  authorName: string;
  authorAvatar?: string;
  caption: string;
  createdAtMillis: number;
  /** Present when this media belongs to a moment, so it can be reacted to. */
  momentId?: bigint;
  reactions?: ReactionTally[];
}

interface Props {
  items: ViewerItem[];
  startKey: string | null;
  onClose: () => void;
  onReact: (momentId: bigint, emoji: string) => void;
}

export function MediaViewer({ items, startKey, onClose, onReact }: Props) {
  const now = useNow(30_000);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (startKey === null) return;
    const found = items.findIndex((i) => i.key === startKey);
    setIndex(found >= 0 ? found : 0);
  }, [startKey, items]);

  const step = useCallback(
    (delta: number) =>
      setIndex((current) => Math.min(items.length - 1, Math.max(0, current + delta))),
    [items.length]
  );

  useEffect(() => {
    if (startKey === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startKey, onClose, step]);

  const current = items[index];

  return (
    <AnimatePresence>
      {startKey !== null && current && (
        <motion.div
          className="viewer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.base }}
          role="dialog"
          aria-modal="true"
          aria-label="Media viewer"
        >
          <div className="viewer__progress" aria-hidden>
            {items.map((item, i) => (
              <span key={item.key} data-on={i === index} />
            ))}
          </div>

          <header className="viewer__head">
            <Avatar name={current.authorName} src={current.authorAvatar} size={36} />
            <div className="viewer__who">
              <span>{current.authorName}</span>
              <span className="viewer__time">
                {timeAgo(current.media.createdAt, now)}
              </span>
            </div>
            <motion.button
              type="button"
              className="icon-btn icon-btn--glass"
              aria-label="Close viewer"
              onClick={onClose}
              {...pressable}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path
                  d="m6.6 6.6 10.8 10.8M17.4 6.6 6.6 17.4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </motion.button>
          </header>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.key}
              className="viewer__stage"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: duration.base }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDragEnd={(_, info) => {
                if (info.offset.x < -70) step(1);
                else if (info.offset.x > 70) step(-1);
              }}
            >
              {current.media.kind === 'video' ? (
                <video
                  className="viewer__photo"
                  src={current.media.url}
                  poster={current.media.posterUrl || undefined}
                  autoPlay
                  loop
                  playsInline
                  controls
                />
              ) : current.media.kind === 'voice' ? (
                <div className="viewer__voice">
                  <VoiceNote
                    url={current.media.url}
                    waveform={current.media.waveform}
                    durationMs={current.media.durationMs}
                    seed={current.key}
                  />
                </div>
              ) : (
                <img
                  className="viewer__photo"
                  src={current.media.url}
                  alt={current.caption || 'Shared moment'}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <footer className="viewer__foot">
            {current.caption && <p className="viewer__caption">{current.caption}</p>}

            {current.momentId !== undefined && (
              <div className="viewer__reactions">
                {QUICK_REACTIONS.map((emoji) => {
                  const tally = current.reactions?.find((r) => r.emoji === emoji);
                  return (
                    <motion.button
                      key={emoji}
                      type="button"
                      data-mine={!!tally?.mine}
                      aria-label={`React ${emoji}`}
                      onClick={() => {
                        haptic('light');
                        onReact(current.momentId!, emoji);
                      }}
                      whileTap={{ scale: 0.84 }}
                      transition={spring.pop}
                    >
                      <span>{emoji}</span>
                      {tally && tally.count > 0 && <b>{tally.count}</b>}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
