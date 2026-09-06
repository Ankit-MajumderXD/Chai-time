/**
 * Roast sheet — the pile-on for a single moment.
 *
 * Top: the moment being roasted. Middle: every roast on it, ranked by votes,
 * reordering live with a spring as votes come in. Bottom: the composer with
 * tap-to-insert Hinglish starters (aimed at the shot, never the person) over a
 * free-text field.
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomSheet } from './Overlay';
import { Avatar } from './Avatar';
import { pressable, spring } from '../design/motion';
import { firstName, timeAgo } from '../lib/format';
import { haptic } from '../lib/haptics';
import { ROAST_CHIPS, ROAST_MAX } from '../lib/roasts';
import { useNow } from '../data/useNow';
import type { MomentView } from '../data/useRoom';
import type { RoastView } from '../data/useRoasts';
import { useCountUp } from '../lib/useCountUp';

interface Props {
  open: boolean;
  onClose: () => void;
  moment: MomentView | undefined;
  roasts: RoastView[];
  onPost: (text: string) => Promise<boolean> | void;
  onVote: (roastId: bigint, voted: boolean) => void;
  onDelete: (roastId: bigint) => void;
}

export function RoastSheet({ open, onClose, moment, roasts, onPost, onVote, onDelete }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const now = useNow(30_000);

  const insert = (chip: string) => {
    haptic('light');
    setText((t) => {
      const next = t.trim() ? `${t.trim()} ${chip}` : chip;
      return next.slice(0, ROAST_MAX);
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const ok = await onPost(body);
    setBusy(false);
    if (ok !== false) {
      setText('');
      haptic('success');
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} label="Roast this moment">
      <div className="roast-sheet">
        <div className="roast-sheet__head">
          <h2 className="t-h2 sheet__title">Roast mode 🔥</h2>
          {moment?.media?.url ? (
            <img className="roast-sheet__thumb" src={moment.media.url} alt="" />
          ) : (
            <p className="roast-sheet__caption">“{moment?.moment.caption || 'this moment'}”</p>
          )}
        </div>

        <div className="roast-sheet__list">
          <AnimatePresence initial={false}>
            {roasts.length === 0 && (
              <motion.p
                key="empty"
                className="t-sm muted roast-sheet__empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                No roasts yet. Somebody has to go first.
              </motion.p>
            )}
            {roasts.map((rv, i) => (
              <RoastRow
                key={String(rv.roast.id)}
                rv={rv}
                rank={i}
                now={now}
                onVote={() => onVote(rv.roast.id, !rv.iVoted)}
                onDelete={rv.mine ? () => onDelete(rv.roast.id) : undefined}
              />
            ))}
          </AnimatePresence>
        </div>

        <form className="roast-sheet__composer" onSubmit={submit}>
          <div className="roast-chips">
            {ROAST_CHIPS.map((chip) => (
              <motion.button
                key={chip}
                type="button"
                className="roast-chip"
                onClick={() => insert(chip)}
                whileTap={{ scale: 0.94 }}
                transition={spring.pop}
              >
                {chip}
              </motion.button>
            ))}
          </div>

          <div className="roast-sheet__field">
            <textarea
              className="input"
              value={text}
              maxLength={ROAST_MAX}
              placeholder="Say it with your chest (about the photo, not the face)…"
              onChange={(e) => setText(e.target.value)}
              rows={2}
            />
            <motion.button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={!text.trim() || busy}
              {...pressable}
            >
              {busy ? '…' : 'Roast'}
            </motion.button>
          </div>
        </form>
      </div>
    </BottomSheet>
  );
}

function RoastRow({
  rv,
  rank,
  now,
  onVote,
  onDelete,
}: {
  rv: RoastView;
  rank: number;
  now: number;
  onVote: () => void;
  onDelete?: () => void;
}) {
  const votes = useCountUp(rv.votes);

  return (
    <motion.div
      className="roast-row"
      data-lead={rank === 0 && rv.votes > 0}
      layout
      initial={{ opacity: 0, y: 14, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.16 } }}
      transition={spring.bouncy}
    >
      <Avatar name={rv.author?.displayName ?? 'Someone'} src={rv.author?.avatarUrl} size={30} />
      <div className="roast-row__body">
        <p className="roast-row__meta">
          <span className="roast-row__who">{firstName(rv.author?.displayName ?? 'Someone')}</span>
          {rank === 0 && rv.votes > 0 && <span className="roast-row__crown">👑 leading</span>}
          <span className="t-xs faint">{timeAgo(rv.roast.createdAt, now)}</span>
        </p>
        <p className="roast-row__text">{rv.roast.text}</p>
      </div>

      <div className="roast-row__actions">
        <motion.button
          type="button"
          className="roast-vote"
          data-voted={rv.iVoted}
          onClick={() => {
            haptic('light');
            onVote();
          }}
          whileTap={{ scale: 0.85 }}
          transition={spring.pop}
          aria-pressed={rv.iVoted}
          aria-label={rv.iVoted ? 'Remove your vote' : 'Upvote this roast'}
        >
          <span className="roast-vote__arrow">▲</span>
          <motion.span
            key={rv.votes}
            className="roast-vote__count"
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={spring.pop}
          >
            {votes}
          </motion.span>
        </motion.button>
        {onDelete && (
          <button
            type="button"
            className="roast-row__del"
            onClick={onDelete}
            aria-label="Delete your roast"
          >
            ✕
          </button>
        )}
      </div>
    </motion.div>
  );
}
