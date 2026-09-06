/**
 * Post preview.
 *
 * The shot fills the screen, the caption sits on the glass at the bottom, and
 * the only real decision left is which room it goes to.
 */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Toast';
import { pressable, riseVariants, spring } from '../design/motion';
import { moodFor } from '../lib/rooms';
import { tooBig } from '../lib/upload';
import { haptic } from '../lib/haptics';
import { call, useConn } from '../data/db';
import { useRooms } from '../data/useRooms';
import { useRouter } from '../lib/router';
import type { Shot } from './Camera';

const STICKERS = ['❤️', '🔥', '😂', '✨', '🫶', '🌙', '🫖', '🎉'];

export function PostPreview({
  shot,
  preferredCode,
  onDiscard,
  onDone,
}: {
  shot: Shot;
  preferredCode?: string;
  onDiscard: () => void;
  onDone: () => void;
}) {
  const conn = useConn();
  const toast = useToast();
  const { go } = useRouter();
  const { rooms } = useRooms();
  const [caption, setCaption] = useState('');
  const [target, setTarget] = useState<bigint | null>(null);
  const [stickers, setStickers] = useState<string[]>([]);
  const [showStickers, setShowStickers] = useState(false);
  const [posting, setPosting] = useState(false);

  const oversized = tooBig(shot.media);

  useEffect(() => {
    if (target !== null || rooms.length === 0) return;
    const preferred = preferredCode
      ? rooms.find((r) => r.room.code === preferredCode)
      : undefined;
    setTarget((preferred ?? rooms[0]).room.id);
  }, [rooms, preferredCode, target]);

  const chosen = useMemo(
    () => rooms.find((r) => r.room.id === target),
    [rooms, target]
  );

  const post = async () => {
    if (!conn || target === null || posting) return;
    if (oversized) {
      toast({ message: 'That clip is a bit heavy — try a shorter one.', tone: 'error' });
      return;
    }
    setPosting(true);
    haptic('success');

    const text = [caption.trim(), stickers.join(' ')].filter(Boolean).join(' ');
    const ok = await call(
      conn.reducers.postMoment({
        roomId: target,
        kind: shot.media.kind,
        caption: text,
        mediaUrl: shot.media.url,
        posterUrl: shot.media.posterUrl,
        mimeType: shot.media.mimeType,
        width: shot.media.width,
        height: shot.media.height,
        durationMs: shot.media.durationMs,
        sizeBytes: shot.media.sizeBytes,
        waveform: shot.media.waveform,
      }),
      (message) => toast({ message, tone: 'error', emoji: '⚠️' })
    );

    if (!ok) {
      setPosting(false);
      return;
    }
    toast({ message: `Shared to ${chosen?.room.name ?? 'your room'}`, emoji: '✨' });
    if (chosen) go({ name: 'room', code: chosen.room.code }, { replace: true });
    else onDone();
  };

  return (
    <motion.div
      className="preview"
      variants={riseVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="preview__media">
        {shot.media.kind === 'photo' ? (
          <img src={shot.media.url} alt="Your capture" />
        ) : (
          <video
            src={shot.media.url}
            poster={shot.media.posterUrl || undefined}
            autoPlay
            loop
            muted
            playsInline
          />
        )}
        <span className="preview__vignette" aria-hidden />

        {stickers.length > 0 && (
          <div className="preview__stickers" aria-hidden>
            <AnimatePresence>
              {stickers.map((sticker, i) => (
                <motion.span
                  key={`${sticker}-${i}`}
                  initial={{ scale: 0.2, opacity: 0, rotate: -20 }}
                  animate={{ scale: 1, opacity: 1, rotate: (i % 2 ? 1 : -1) * 8 }}
                  exit={{ scale: 0.3, opacity: 0 }}
                  transition={spring.pop}
                >
                  {sticker}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <header className="preview__top">
        <motion.button
          type="button"
          className="icon-btn icon-btn--glass"
          aria-label="Retake"
          onClick={onDiscard}
          {...pressable}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path
              d="M14.5 5.5 8 12l6.5 6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>

        <div className="preview__tools">
          <motion.button
            type="button"
            className="icon-btn icon-btn--glass"
            aria-label="Add text"
            onClick={() => document.getElementById('caption-field')?.focus()}
            {...pressable}
          >
            <span className="preview__aa">Aa</span>
          </motion.button>
          <motion.button
            type="button"
            className="icon-btn icon-btn--glass"
            aria-label="Stickers"
            data-open={showStickers}
            onClick={() => setShowStickers((v) => !v)}
            {...pressable}
          >
            <span>🫶</span>
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {showStickers && (
          <motion.div
            className="sticker-tray"
            initial={{ opacity: 0, y: -12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={spring.bouncy}
          >
            {STICKERS.map((sticker) => (
              <motion.button
                key={sticker}
                type="button"
                onClick={() => {
                  haptic('light');
                  setStickers((current) =>
                    current.includes(sticker)
                      ? current.filter((s) => s !== sticker)
                      : [...current, sticker].slice(0, 4)
                  );
                }}
                data-on={stickers.includes(sticker)}
                whileTap={{ scale: 0.85 }}
              >
                {sticker}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="preview__sheet glass">
        <input
          id="caption-field"
          className="preview__caption"
          placeholder="Add a caption…"
          value={caption}
          maxLength={180}
          onChange={(e) => setCaption(e.target.value)}
        />

        <div className="preview__share">
          <span className="t-xs muted preview__share-label">Share to</span>
          <div className="preview__rooms">
            {rooms.map((summary) => {
              const mood = moodFor(summary.room.kind);
              const active = summary.room.id === target;
              return (
                <motion.button
                  key={String(summary.room.id)}
                  type="button"
                  className="room-chip"
                  data-mood={summary.room.kind}
                  data-active={active}
                  onClick={() => {
                    haptic('light');
                    setTarget(summary.room.id);
                  }}
                  whileTap={{ scale: 0.94 }}
                  transition={spring.pop}
                >
                  <span className="room-chip__emoji">{summary.room.emoji || mood.emoji}</span>
                  <span className="truncate">{summary.room.name}</span>
                  {summary.activeCount > 0 && (
                    <span className="room-chip__live">{summary.activeCount}</span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        <motion.button
          className="btn btn--primary btn--block preview__post"
          onClick={post}
          disabled={posting || target === null}
          {...pressable}
        >
          {posting ? (
            'Sharing…'
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path d="M4.4 11.9 19.2 5.2 13.6 20l-2.4-6.1-6.8-2Z" fill="currentColor" />
              </svg>
              Post{chosen ? ` to ${chosen.room.name}` : ''}
            </>
          )}
        </motion.button>

        {chosen && (
          <div className="preview__audience">
            <div className="preview__faces">
              {chosen.others.slice(0, 4).map((member) => (
                <Avatar
                  key={String(member.id)}
                  name={member.displayName}
                  src={member.avatarUrl}
                  size={22}
                />
              ))}
            </div>
            <span className="t-micro faint">
              {chosen.members.length} {chosen.members.length === 1 ? 'person' : 'people'} will see
              this
            </span>
          </div>
        )}
      </footer>
    </motion.div>
  );
}
