/**
 * A moment: somebody's photograph, clip, voice note or thought, and what
 * everyone said back.
 *
 * Deliberately not a social post — no follower count, no share button, no
 * three-dot menu unless it's yours. Big media, small metadata.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { VoiceNote } from './VoiceNote';
import { EmojiPopover } from './EmojiPopover';
import { FireBurst } from './FireBurst';
import { itemVariants, pressable, spring } from '../design/motion';
import { firstName, timeAgo } from '../lib/format';
import { formatDuration } from '../lib/audio';
import { QUICK_REACTIONS } from '../lib/rooms';
import { haptic } from '../lib/haptics';
import { debug } from '../lib/log';
import { useNow } from '../data/useNow';
import type { MomentView } from '../data/useRoom';
import type { MomentRoastReactions } from '../data/useRoastReactions';
import { HEATS, type Heat } from '../lib/roastLines';

interface Props {
  view: MomentView;
  onReact: (emoji: string) => void;
  /** Arms a quoted reply and jumps to Chat — replies are messages. */
  onReply: () => void;
  onOpen: () => void;
  onDelete?: () => void;
  /** Video only plays by itself when the viewer has opted in. */
  autoplayVideo?: boolean;
  /** Present only while the room's roast mode is on. */
  roast?: { count: number; leadText?: string; onOpen: () => void };
  /** Fire roast reactions on this moment (always available). */
  roastReactions?: MomentRoastReactions;
  onRoastReact?: () => void;
  /** Bumped when this client just sent a roast reaction — plays the burst. */
  roastBurst?: { heat: Heat; nonce: number };
}

export const MomentCard = memo(function MomentCard({
  view,
  onReact,
  onReply,
  onOpen,
  onDelete,
  autoplayVideo = false,
  roast,
  roastReactions,
  onRoastReact,
  roastBurst,
}: Props) {
  const now = useNow(30_000);
  const { moment, media, author, reactions, replies, isMine } = view;
  const [showPicker, setShowPicker] = useState(false);
  const [bursts, setBursts] = useState<Array<{ id: number; emoji: string }>>([]);
  const [roastExpanded, setRoastExpanded] = useState(false);
  const [fire, setFire] = useState<{ heat: Heat; nonce: number } | null>(null);
  const burstId = useRef(0);
  const lastTap = useRef(0);

  // Play the ember burst when this client's own roast reaction lands.
  useEffect(() => {
    if (!roastBurst) return;
    setFire(roastBurst);
    const t = window.setTimeout(() => setFire(null), 1300);
    return () => window.clearTimeout(t);
  }, [roastBurst?.nonce]);

  const burst = (emoji: string) => {
    const id = ++burstId.current;
    setBursts((current) => [...current, { id, emoji }]);
    window.setTimeout(
      () => setBursts((current) => current.filter((b) => b.id !== id)),
      900
    );
  };

  const react = (emoji: string) => {
    haptic('light');
    burst(emoji);
    onReact(emoji);
    setShowPicker(false);
  };

  // Double-tap the media to love it — the gesture everyone already knows.
  const onMediaTap = () => {
    const stamp = Date.now();
    if (stamp - lastTap.current < 320) {
      lastTap.current = 0;
      haptic('medium');
      burst('❤️');
      onReact('❤️');
    } else {
      lastTap.current = stamp;
      window.setTimeout(() => {
        if (lastTap.current !== 0 && Date.now() - lastTap.current >= 300) {
          lastTap.current = 0;
          onOpen();
        }
      }, 330);
    }
  };

  return (
    <motion.article className="moment" variants={itemVariants} layout="position">
      <header className="moment__head">
        <Avatar
          name={author?.displayName ?? 'Someone'}
          src={author?.avatarUrl}
          size={38}
          presence={(author?.status as any) ?? null}
        />
        <div className="moment__who">
          <span className="moment__name truncate">
            {isMine ? 'You' : (author?.displayName ?? 'Someone')}
          </span>
          <span className="moment__time">{timeAgo(moment.createdAt, now)}</span>
        </div>
        {isMine && onDelete && (
          <motion.button
            type="button"
            className="icon-btn icon-btn--bare moment__more"
            aria-label="Remove this moment"
            onClick={onDelete}
            {...pressable}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
              <g fill="currentColor">
                <circle cx="6" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="18" cy="12" r="1.6" />
              </g>
            </svg>
          </motion.button>
        )}
      </header>

      {media && media.kind === 'voice' ? (
        <div className="moment__voice">
          <VoiceNote
            url={media.url}
            waveform={media.waveform}
            durationMs={media.durationMs}
            seed={String(moment.id)}
          />
        </div>
      ) : media ? (
        <motion.div
          className="moment__media"
          onClick={onMediaTap}
          whileTap={{ scale: 0.99 }}
          transition={spring.snappy}
          role="button"
          tabIndex={0}
          aria-label={media.kind === 'video' ? 'Play video' : 'Open photo'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen();
            }
          }}
        >
          {media.kind === 'video' ? (
            <>
              <video
                src={media.url}
                poster={media.posterUrl || undefined}
                muted
                loop
                playsInline
                autoPlay={autoplayVideo}
                preload="metadata"
                onLoadedMetadata={(e) =>
                  debug('video', 'moment loadedmetadata', {
                    momentId: String(moment.id),
                    w: e.currentTarget.videoWidth,
                    h: e.currentTarget.videoHeight,
                    dur: e.currentTarget.duration,
                  })
                }
                onError={(e) =>
                  debug('video', 'moment ERROR', {
                    momentId: String(moment.id),
                    code: e.currentTarget.error?.code,
                    message: e.currentTarget.error?.message,
                    mimeType: media.mimeType,
                    urlScheme: media.url.slice(0, media.url.indexOf(',') + 1) || media.url.slice(0, 24),
                    urlLen: media.url.length,
                  })
                }
              />
              {!autoplayVideo && (
                <span className="moment__play" aria-hidden>
                  ▶
                </span>
              )}
              {media.durationMs > 0 && (
                <span className="moment__duration">{formatDuration(media.durationMs)}</span>
              )}
            </>
          ) : (
            <img src={media.url} alt={moment.caption || 'A shared moment'} loading="lazy" />
          )}

          <AnimatePresence>
            {bursts.map((b) => (
              <ReactionBurst key={b.id} emoji={b.emoji} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="moment__note">{moment.caption}</div>
      )}

      {media && moment.caption && <p className="moment__caption">{moment.caption}</p>}

      <ReactionBar
        reactions={reactions}
        replyCount={replies.length}
        pickerOpen={showPicker}
        onTogglePicker={() => setShowPicker((v) => !v)}
        onReact={react}
        onReply={onReply}
      />

      {roast && (
        <motion.button
          type="button"
          className="moment__roast"
          onClick={() => {
            haptic('light');
            roast.onOpen();
          }}
          whileTap={{ scale: 0.97 }}
          transition={spring.snappy}
        >
          <span className="moment__roast-flame">🔥</span>
          <span className="truncate">
            {roast.count === 0
              ? 'Roast this one'
              : roast.leadText
                ? `“${roast.leadText}”`
                : `${roast.count} roast${roast.count === 1 ? '' : 's'}`}
          </span>
          {roast.count > 0 && <span className="moment__roast-count">{roast.count}</span>}
        </motion.button>
      )}

      {onRoastReact && (
        <div className="fire-row">
          <span className="fire-anchor">
            <motion.button
              type="button"
              className="fire-btn"
              onClick={() => {
                haptic('light');
                onRoastReact();
              }}
              whileTap={{ scale: 0.9 }}
              transition={spring.pop}
              aria-label="Fire roast reaction"
            >
              🔥
            </motion.button>
            <AnimatePresence>{fire && <FireBurst key={fire.nonce} heat={fire.heat} />}</AnimatePresence>
          </span>

          {roastReactions && roastReactions.count > 0 && (
            <motion.button
              type="button"
              className="fire-badge"
              data-flare={roastReactions.allHeats}
              onClick={() => setRoastExpanded((v) => !v)}
              whileTap={{ scale: 0.94 }}
              transition={spring.snappy}
              aria-expanded={roastExpanded}
            >
              <span className="fire-badge__flames">
                {roastReactions.heats.map((h) => (
                  <span key={h} style={{ ['--heat-hue' as string]: HEATS[h].hue }}>🔥</span>
                ))}
              </span>
              <motion.span
                key={roastReactions.count}
                className="fire-badge__count"
                initial={{ y: -5, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={spring.pop}
              >
                {roastReactions.count}
              </motion.span>
            </motion.button>
          )}
        </div>
      )}

      <AnimatePresence>
        {roastExpanded && roastReactions && roastReactions.count > 0 && (
          <motion.ul
            className="fire-list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {roastReactions.list.map((rr) => (
              <li key={String(rr.id)} className="fire-list__row">
                <Avatar name={rr.member?.displayName ?? 'Someone'} src={rr.member?.avatarUrl} size={22} />
                <span className="fire-list__who">{firstName(rr.member?.displayName ?? 'Someone')}</span>
                <span className="fire-list__text truncate">{rr.text}</span>
                <span className="fire-list__heat" style={{ ['--heat-hue' as string]: HEATS[rr.heat].hue }}>
                  {HEATS[rr.heat].flames}
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {replies.length > 0 && (
        <ul className="moment__replies">
          {replies.slice(-3).map(({ message, author: replyAuthor }) => (
            <motion.li
              key={String(message.id)}
              className="reply"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.gentle}
            >
              <Avatar
                name={replyAuthor?.displayName ?? 'Someone'}
                src={replyAuthor?.avatarUrl}
                size={22}
              />
              <span className="reply__text">
                <b>{firstName(replyAuthor?.displayName ?? 'Someone')}</b>{' '}
                {message.text || (message.kind === 'voice' ? 'sent a voice note' : 'sent a photo')}
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.article>
  );
});

/* ------------------------------------------------------- Reaction burst --- */

/** A reaction pops upward and throws off three small sparks. Nothing more. */
function ReactionBurst({ emoji }: { emoji: string }) {
  return (
    <motion.span
      className="burst"
      initial={{ opacity: 0, scale: 0.4, y: 0 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.25, 1.1, 1], y: [0, -18, -34, -52] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, times: [0, 0.25, 0.6, 1], ease: 'easeOut' }}
      aria-hidden
    >
      <span className="burst__glyph">{emoji}</span>
      {[0, 1, 2].map((i) => (
        <motion.i
          key={i}
          className="burst__spark"
          initial={{ opacity: 0.9, x: 0, y: 0, scale: 1 }}
          animate={{
            opacity: 0,
            x: [0, (i - 1) * 26],
            y: [0, -14 - i * 9],
            scale: 0.4,
          }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      ))}
    </motion.span>
  );
}

/* ---------------------------------------------------------- Reaction bar -- */

export function ReactionBar({
  reactions,
  replyCount,
  pickerOpen,
  onTogglePicker,
  onReact,
  onReply,
}: {
  reactions: Array<{ emoji: string; count: number; mine: boolean }>;
  replyCount: number;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onReact: (emoji: string) => void;
  onReply?: () => void;
}) {
  const [fullPicker, setFullPicker] = useState(false);

  return (
    <div className="reactions">
      <AnimatePresence initial={false}>
        {reactions.map((r) => (
          <motion.button
            key={r.emoji}
            type="button"
            className="reaction"
            data-mine={r.mine}
            layout
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={spring.pop}
            onClick={() => onReact(r.emoji)}
            whileTap={{ scale: 0.9 }}
            aria-label={`${r.emoji} ${r.count}${r.mine ? ', including you' : ''}`}
          >
            <span className="reaction__emoji">{r.emoji}</span>
            <motion.span
              key={r.count}
              className="reaction__count"
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={spring.pop}
            >
              {r.count}
            </motion.span>
          </motion.button>
        ))}
      </AnimatePresence>

      <motion.button
        type="button"
        className="reaction reaction--add"
        aria-label="Add a reaction"
        aria-expanded={pickerOpen}
        data-open={pickerOpen}
        onClick={onTogglePicker}
        {...pressable}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
          <circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M9 14.4c.8.9 1.8 1.3 3 1.3s2.2-.4 3-1.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx="9.4" cy="10" r="1.05" fill="currentColor" />
          <circle cx="14.6" cy="10" r="1.05" fill="currentColor" />
        </svg>
      </motion.button>

      {onReply && (
        <motion.button
          type="button"
          className="reaction reaction--reply"
          onClick={onReply}
          aria-label={
            replyCount > 0
              ? `Reply — ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'} so far`
              : 'Reply to this moment'
          }
          {...pressable}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <path
              d="M20 17.5c0-3.6-2.9-5.6-7.4-5.6h-1.4v3.4L5 10.2 11.2 5v3.3h1.4c4.6 0 7.4 3.3 7.4 9.2Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
          {replyCount > 0 && <span className="reaction__count">{replyCount}</span>}
        </motion.button>
      )}

      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            className="reaction-picker"
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            transition={spring.bouncy}
          >
            {QUICK_REACTIONS.map((emoji, i) => (
              <motion.button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                aria-label={`React ${emoji}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.pop, delay: i * 0.03 }}
                whileTap={{ scale: 0.82 }}
              >
                {emoji}
              </motion.button>
            ))}
            <span className="emoji-anchor">
              <motion.button
                type="button"
                className="reaction-picker__more"
                aria-label="More reactions"
                onClick={() => setFullPicker((v) => !v)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.pop, delay: QUICK_REACTIONS.length * 0.03 }}
                whileTap={{ scale: 0.82 }}
              >
                ＋
              </motion.button>
              <EmojiPopover
                open={fullPicker}
                onClose={() => setFullPicker(false)}
                onPick={(emoji) => onReact(emoji)}
                align="center"
              />
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
