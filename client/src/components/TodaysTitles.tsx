/**
 * "Today's Titles" — the room's superlatives for the day.
 *
 * The rows come straight from the `room_title` table, which the daily pass in
 * `sweep` recomputes every tick, so this card updates live as the day's
 * activity shifts — a fresh burst of moments can hand someone "Most Active"
 * mid-afternoon. A title with no real contender is simply absent.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { itemVariants, spring } from '../design/motion';
import { firstName } from '../lib/format';
import type { RoomTitleView } from '../data/useRoom';

const TITLE_META: Record<string, { name: string; emoji: string; blurb: string }> = {
  most_active: { name: 'Most Active', emoji: '⚡', blurb: 'posted more moments than anyone today' },
  life_of_room: { name: 'Life of the Room', emoji: '🎉', blurb: 'pulled in the most reactions today' },
  roast_champion: { name: 'Roast Champion', emoji: '🔥', blurb: 'won the most roast votes today' },
  craziest_one: { name: 'Craziest One', emoji: '🤪', blurb: 'racked up the most savage roast reactions' },
  streak_legend: { name: 'Streak Legend', emoji: '🏆', blurb: 'longest posting streak in the room' },
  night_owl: { name: 'Night Owl', emoji: '🌙', blurb: 'most moments between midnight and 5am' },
};

export function TodaysTitles({ titles }: { titles: RoomTitleView[] }) {
  const rows = titles.filter((t) => TITLE_META[t.titleType] && t.member);
  if (rows.length === 0) return null;

  return (
    <motion.div
      className="titles-card"
      variants={itemVariants}
      initial="initial"
      animate="animate"
    >
      <div className="titles-card__head">
        <span className="t-micro">🏅 Today's Titles</span>
        <span className="t-xs faint">{rows.length} awarded</span>
      </div>

      <ul className="titles-card__list">
        <AnimatePresence initial={false}>
          {rows.map(({ titleType, member }) => {
            const meta = TITLE_META[titleType];
            return (
              <motion.li
                key={titleType}
                className="title-row"
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                transition={spring.gentle}
              >
                <span className="title-row__badge" aria-hidden>
                  {meta.emoji}
                </span>
                <Avatar name={member!.displayName} src={member!.avatarUrl} size={30} />
                <span className="title-row__text">
                  <span className="title-row__name">
                    {meta.name}
                    <span className="title-row__holder"> · {firstName(member!.displayName)}</span>
                  </span>
                  <span className="title-row__blurb">{meta.blurb}</span>
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </motion.div>
  );
}
