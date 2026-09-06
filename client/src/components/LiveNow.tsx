/**
 * Presence surfaces: the "Your people" rail on Home, "Live now" inside a room,
 * and the member row used by the Members tab.
 *
 * All three answer the same question — what is this person doing right now —
 * at three different sizes.
 */
import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, type Presence } from './Avatar';
import { itemVariants, listVariants, pressable, spring } from '../design/motion';
import { firstName, shortTimeAgo } from '../lib/format';
import { useNow } from '../data/useNow';
import type { RoomMember } from '../module_bindings/types';

function presenceOf(member: RoomMember): Presence {
  return (member.status as Presence) ?? 'offline';
}

/* -------------------------------------------------- Home: "Your people" --- */

export function PeopleRail({
  people,
  onAdd,
  onSelect,
}: {
  people: RoomMember[];
  onAdd: () => void;
  onSelect?: (member: RoomMember) => void;
}) {
  return (
    <motion.div className="rail people-rail" variants={listVariants} initial="initial" animate="animate">
      <motion.button
        type="button"
        className="people-rail__item people-rail__add"
        variants={itemVariants}
        onClick={onAdd}
        {...pressable}
      >
        <span className="people-rail__addcircle">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </span>
        <span className="people-rail__name">Add</span>
      </motion.button>

      {people.map((person) => (
        <motion.button
          key={String(person.id)}
          type="button"
          className="people-rail__item"
          variants={itemVariants}
          onClick={() => onSelect?.(person)}
          {...pressable}
        >
          <Avatar
            name={person.displayName}
            src={person.avatarUrl}
            size={58}
            presence={presenceOf(person)}
            ring={person.status === 'online'}
          />
          <span className="people-rail__name truncate">{firstName(person.displayName)}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}

/* --------------------------------------------------- Room: "Live now" ----- */

export function LiveNow({
  members,
  meId,
  onOpenMembers,
}: {
  members: RoomMember[];
  meId: bigint | undefined;
  onOpenMembers: () => void;
}) {
  // Me first, then whoever is most present.
  const ordered = [...members].sort((a, b) => {
    if (a.id === meId) return -1;
    if (b.id === meId) return 1;
    return 0;
  });

  return (
    <motion.div className="rail live-rail" variants={listVariants} initial="initial" animate="animate">
      <AnimatePresence initial={false}>
        {ordered.map((member) => {
          const isMe = member.id === meId;
          const presence = presenceOf(member);
          return (
            <motion.button
              key={String(member.id)}
              type="button"
              className="live-card"
              data-presence={presence}
              layout
              variants={itemVariants}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={onOpenMembers}
              whileTap={{ scale: 0.97 }}
              transition={spring.gentle}
            >
              <Avatar
                name={member.displayName}
                src={member.avatarUrl}
                size={52}
                presence={presence}
                badge={member.activityEmoji || undefined}
                ring={presence === 'online'}
              />
              <span className="live-card__name truncate">
                {isMe ? 'You' : firstName(member.displayName)}
              </span>
              <motion.span
                key={member.activity || presence}
                className="live-card__activity truncate"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
                {member.activity || (presence === 'online' ? 'Online' : 'Away')}
              </motion.span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------- Members tab: rows ------ */

export const ActivityRow = memo(function ActivityRow({
  member,
  isMe,
  onPress,
}: {
  member: RoomMember;
  isMe: boolean;
  onPress?: () => void;
}) {
  const now = useNow(30_000);
  const presence = presenceOf(member);

  return (
    <motion.button
      type="button"
      className="member-row"
      variants={itemVariants}
      onClick={onPress}
      disabled={!onPress}
      {...(onPress ? pressable : {})}
    >
      <Avatar
        name={member.displayName}
        src={member.avatarUrl}
        size={46}
        presence={presence}
        ring={presence === 'online'}
      />
      <div className="member-row__text">
        <span className="member-row__name truncate">
          {member.displayName}
          {isMe && <span className="pill pill--accent member-row__you">you</span>}
        </span>
        <span className="member-row__activity truncate">
          {member.activityEmoji && <span>{member.activityEmoji} </span>}
          {member.activity || (presence === 'online' ? 'Online' : 'Nothing shared')}
        </span>
      </div>
      <div className="member-row__meta">
        <span className={`member-row__status member-row__status--${presence}`}>
          {presence === 'online' ? 'Online' : presence === 'away' ? 'Away' : 'Offline'}
        </span>
        <span className="member-row__seen">{shortTimeAgo(member.lastSeenAt, now)}</span>
      </div>
    </motion.button>
  );
});

/* ------------------------------------------------- Live ticker ------------ */

/** "3 people are active · 2 viewing · Mom is typing…" */
export function RoomPulse({
  activeCount,
  viewingCount,
  typingNames,
}: {
  activeCount: number;
  viewingCount: number;
  typingNames: string[];
}) {
  const parts: string[] = [];
  if (typingNames.length === 1) parts.push(`${typingNames[0]} is typing…`);
  else if (typingNames.length > 1) parts.push(`${typingNames.length} people are typing…`);
  if (activeCount > 0) parts.push(`${activeCount} active`);
  if (viewingCount > 0) parts.push(`${viewingCount} viewing`);

  const label = parts.join(' · ') || 'Quiet right now';

  return (
    <div className="room-pulse">
      <span className="dot-live room-pulse__dot" aria-hidden />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={label}
          className="t-xs"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.18 }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
