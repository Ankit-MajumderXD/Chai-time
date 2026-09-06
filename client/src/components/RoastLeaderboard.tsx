/**
 * Roast leaderboard — the room's current standings as a ranked mini-feed.
 *
 * Rows are sorted by votes and carry `layout`, so a vote that changes the order
 * slides rows past each other instead of snapping. Each row reads like a post:
 * the moment's thumbnail, the roast text, who wrote it, and a prominent vote
 * count.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from './Avatar';
import { spring } from '../design/motion';
import { firstName } from '../lib/format';
import { haptic } from '../lib/haptics';
import { useCountUp } from '../lib/useCountUp';
import type { RoastView } from '../data/useRoasts';

interface Props {
  roasts: RoastView[];
  /** momentId → still image (poster for a video, the photo itself, '' for voice). */
  thumbs?: Map<bigint, string>;
  limit?: number;
  onOpen: (momentId: bigint) => void;
}

export function RoastLeaderboard({ roasts, thumbs, limit = 5, onOpen }: Props) {
  const top = roasts.filter((r) => r.votes > 0).slice(0, limit);
  if (top.length === 0) return null;

  return (
    <div className="roast-board">
      <div className="roast-board__head">
        <span className="t-micro">🔥 Roast standings</span>
        <span className="t-xs faint">{roasts.length} roasts</span>
      </div>
      <div className="roast-board__list">
        <AnimatePresence initial={false}>
          {top.map((rv, i) => (
            <LeaderRow
              key={String(rv.roast.id)}
              rv={rv}
              rank={i}
              thumb={thumbs?.get(rv.roast.momentId) ?? ''}
              onOpen={() => onOpen(rv.roast.momentId)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LeaderRow({
  rv,
  rank,
  thumb,
  onOpen,
}: {
  rv: RoastView;
  rank: number;
  thumb: string;
  onOpen: () => void;
}) {
  const votes = useCountUp(rv.votes);
  return (
    <motion.button
      type="button"
      className="roast-board__row"
      data-rank={rank}
      layout
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
      transition={spring.bouncy}
      onClick={() => {
        haptic('light');
        onOpen();
      }}
    >
      <span className="roast-board__rank">{rank === 0 ? '👑' : `#${rank + 1}`}</span>

      <span className="roast-board__thumb" aria-hidden>
        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span>🔥</span>}
      </span>

      <span className="roast-board__body">
        <span className="roast-board__text">{rv.roast.text}</span>
        <span className="roast-board__meta">
          <Avatar name={rv.author?.displayName ?? 'Someone'} src={rv.author?.avatarUrl} size={16} />
          {firstName(rv.author?.displayName ?? 'Someone')}
        </span>
      </span>

      <motion.span
        key={rv.votes}
        className="roast-board__votes"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring.pop}
      >
        ▲ {votes}
      </motion.span>
    </motion.button>
  );
}
