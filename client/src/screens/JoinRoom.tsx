/**
 * The invite-link landing.
 *
 * Someone tapped a link in a group chat. They should see the room and the faces
 * before they're asked for anything — and the "anything" is one button.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TopBar } from '../components/TopBar';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/Feedback';
import { useToast } from '../components/Toast';
import { itemVariants, listVariants, pressable, spring } from '../design/motion';
import { memberSummary } from '../lib/format';
import { coverFor, moodFor } from '../lib/rooms';
import { haptic } from '../lib/haptics';
import { useRouter } from '../lib/router';
import { useRoom } from '../data/useRoom';
import { call, useConn } from '../data/db';

export function JoinRoom({ code }: { code: string }) {
  const { go } = useRouter();
  const conn = useConn();
  const toast = useToast();
  const room = useRoom(code);
  const [joining, setJoining] = useState(false);

  // Already in? Don't make them ask twice.
  useEffect(() => {
    if (room.isMember) go({ name: 'room', code }, { replace: true });
  }, [room.isMember, code, go]);

  if (room.notFound) {
    return (
      <div className="screen">
        <TopBar onBack={() => go({ name: 'rooms' })} />
        <EmptyState
          art={<span className="empty__emoji">🔍</span>}
          title="That invite has expired."
          body="Ask whoever sent it for a fresh link, or start a room of your own."
          action={{ label: 'Create a room', onClick: () => go({ name: 'create' }) }}
          secondary={{ label: 'Back home', onClick: () => go({ name: 'rooms' }) }}
        />
      </div>
    );
  }

  if (!room.room) {
    return (
      <div className="screen">
        <TopBar onBack={() => go({ name: 'rooms' })} />
        <div className="gutter">
          <div className="skeleton" style={{ height: 260, borderRadius: 'var(--r-2xl)' }} />
        </div>
      </div>
    );
  }

  const mood = moodFor(room.room.kind);

  const join = async () => {
    if (joining) return;
    setJoining(true);
    haptic('success');
    const ok = await call(conn?.reducers.joinRoom({ code }), (message) =>
      toast({ message, tone: 'error', emoji: '⚠️' })
    );
    if (ok) {
      toast({ message: `You're in ${room.room?.name}`, emoji: '🎉' });
      go({ name: 'room', code }, { replace: true });
    } else {
      setJoining(false);
    }
  };

  return (
    <div className="screen join-screen" data-mood={room.room.kind}>
      <TopBar onBack={() => go({ name: 'rooms' })} />

      <motion.div
        className="gutter stack join-screen__body"
        variants={listVariants}
        initial="initial"
        animate="animate"
      >
        <motion.div className="join-cover" variants={itemVariants}>
          <img src={room.room.coverUrl || coverFor(room.room.kind, code)} alt="" />
          <span className="join-cover__scrim" aria-hidden />
          <motion.span
            className="join-cover__emoji"
            initial={{ scale: 0.4, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={spring.bouncy}
          >
            {room.room.emoji || mood.emoji}
          </motion.span>
        </motion.div>

        <motion.div className="stack join-screen__copy" variants={itemVariants}>
          <p className="t-sm muted">You've been invited to</p>
          <h1 className="t-h1">{room.room.name}</h1>
          <p className="t-sm muted">
            {memberSummary(room.members.length, room.activeCount)} · private room
          </p>
        </motion.div>

        <motion.div className="join-faces" variants={itemVariants}>
          {room.members.slice(0, 7).map((member) => (
            <Avatar
              key={String(member.id)}
              name={member.displayName}
              src={member.avatarUrl}
              size={44}
              presence={member.status as any}
            />
          ))}
        </motion.div>
      </motion.div>

      <div className="sticky-foot gutter">
        <motion.button
          className="btn btn--primary btn--block"
          onClick={join}
          disabled={joining}
          {...pressable}
        >
          {joining ? 'Letting you in…' : `Join ${room.room.name}`}
        </motion.button>
        <p className="t-xs faint join-screen__fine">
          Only people in this room can see what's shared here.
        </p>
      </div>
    </div>
  );
}
