/**
 * Home.
 *
 * Answers one question in the first second: who are my people and what are they
 * doing. Presence first, rooms second, everything else nowhere.
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar } from '../components/Avatar';
import { PeopleRail } from '../components/LiveNow';
import { RoomCard } from '../components/RoomCard';
import { RoomsSkeleton, EmptyState } from '../components/Feedback';
import { BottomSheet } from '../components/Overlay';
import { useToast } from '../components/Toast';
import { listVariants, pressable, spring } from '../design/motion';
import { firstName, greeting, timeAgo } from '../lib/format';
import { ACTIVITY_PRESETS } from '../lib/rooms';
import { haptic } from '../lib/haptics';
import { useRouter } from '../lib/router';
import { useRooms } from '../data/useRooms';
import { useSession } from '../data/useSession';
import { useNow } from '../data/useNow';
import { call, useConn } from '../data/db';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';

export function Rooms() {
  const { go } = useRouter();
  const { me } = useSession();
  const conn = useConn();
  const toast = useToast();
  const now = useNow(30_000);
  const { ready, rooms, people } = useRooms();
  const [activitySheet, setActivitySheet] = useState(false);
  const [inbox, setInbox] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const [events] = useTable(tables.roomEvent);

  const myRoomIds = useMemo(() => new Set(rooms.map((r) => r.room.id)), [rooms]);
  const recent = useMemo(
    () =>
      [...events]
        .filter((e) => myRoomIds.has(e.roomId))
        .sort((a, b) =>
          Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
        )
        .slice(0, 12),
    [events, myRoomIds]
  );

  const myMembership = rooms[0]?.me;
  const currentActivity = myMembership?.activity ?? '';
  const currentEmoji = myMembership?.activityEmoji ?? '';

  const joinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code || joiningCode) return;
    setJoiningCode(true);
    haptic('medium');
    const ok = await call(
      conn?.reducers.joinRoom({ code }),
      (message) => toast({ message, tone: 'error', emoji: '⚠️' })
    );
    setJoiningCode(false);
    if (ok) {
      setJoinCode('');
      go({ name: 'room', code });
    }
  };

  const setActivity = async (emoji: string, label: string) => {
    haptic('light');
    setActivitySheet(false);
    await call(
      conn?.reducers.setActivity({
        activity: label === 'Around' ? '' : label,
        activityEmoji: label === 'Around' ? '' : emoji,
        status: 'online',
      }),
      (message) => toast({ message, tone: 'error' })
    );
  };

  return (
    <div className="screen rooms">
      <header className="home-head gutter">
        <div className="home-head__text">
          <p className="t-sm muted">{greeting()},</p>
          <h1 className="t-h1">
            {firstName(me?.displayName ?? 'friend')} <span className="wave">👋</span>
          </h1>
        </div>

        <div className="home-head__actions">
          <motion.button
            type="button"
            className="icon-btn"
            aria-label="Recent activity"
            onClick={() => setInbox(true)}
            {...pressable}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
              <path
                d="M6.4 10.2a5.6 5.6 0 0 1 11.2 0v3.3l1.5 2.6H4.9l1.5-2.6v-3.3Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M10 18.4a2.1 2.1 0 0 0 4 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            {recent.length > 0 && <span className="icon-btn__dot" aria-hidden />}
          </motion.button>

          <motion.button
            type="button"
            className="home-head__me"
            aria-label="Your profile"
            onClick={() => go({ name: 'profile' })}
            {...pressable}
          >
            <Avatar name={me?.displayName ?? 'You'} src={me?.avatarUrl} size={40} ring />
          </motion.button>
        </div>
      </header>

      {/* What I'm up to — one tap, mirrored into every room I'm in. */}
      <motion.button
        type="button"
        className="status-chip gutter"
        onClick={() => setActivitySheet(true)}
        {...pressable}
      >
        <span className="status-chip__inner">
          <span className="status-chip__emoji">{currentEmoji || '💭'}</span>
          <span className="status-chip__text truncate">
            {currentActivity || "What's happening?"}
          </span>
          <span className="status-chip__edit t-micro">Set</span>
        </span>
      </motion.button>

      {!ready ? (
        <div style={{ marginTop: 'var(--s-6)' }}>
          <RoomsSkeleton />
        </div>
      ) : (
        <>
          {people.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2 className="t-h3">Your people</h2>
                <span className="t-xs faint">
                  {people.filter((p) => p.status === 'online').length} live now
                </span>
              </div>
              <PeopleRail people={people} onAdd={() => go({ name: 'create' })} />
            </section>
          )}

          <section className="section">
            <div className="section-head">
              <h2 className="t-h3">Your rooms</h2>
              <motion.button
                type="button"
                className="link-btn"
                onClick={() => go({ name: 'create' })}
                {...pressable}
              >
                + Create
              </motion.button>
            </div>

            <form
              className="gutter"
              onSubmit={joinByCode}
              style={{ display: 'flex', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}
            >
              <input
                className="input"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Have a room code?"
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
                aria-label="Room code"
                style={{ flex: 1, textTransform: 'uppercase' }}
              />
              <button
                type="submit"
                className="btn btn--soft btn--sm"
                disabled={joinCode.trim().length < 4 || joiningCode}
              >
                {joiningCode ? 'Joining…' : 'Join'}
              </button>
            </form>

            {rooms.length === 0 ? (
              <div className="gutter">
                <EmptyState
                  art={<StackedArt />}
                  title="Your people are waiting ✨"
                  body="Make a private room and drop the link in your group chat. That's the whole setup."
                  action={{ label: 'Create your first room', onClick: () => go({ name: 'create' }) }}
                />
              </div>
            ) : (
              <motion.div
                className="gutter room-list"
                variants={listVariants}
                initial="initial"
                animate="animate"
              >
                {rooms.map((summary) => (
                  <RoomCard
                    key={String(summary.room.id)}
                    summary={summary}
                    onOpen={() => go({ name: 'room', code: summary.room.code })}
                  />
                ))}
              </motion.div>
            )}
          </section>
        </>
      )}

      <BottomSheet
        open={activitySheet}
        onClose={() => setActivitySheet(false)}
        label="Set your activity"
      >
        <h2 className="t-h2 sheet__title">What are you up to?</h2>
        <p className="t-sm muted">Your people see this next to your name.</p>
        <div className="activity-grid">
          {ACTIVITY_PRESETS.map((preset) => (
            <motion.button
              key={preset.label}
              type="button"
              className="activity-grid__item"
              data-selected={preset.label === currentActivity}
              onClick={() => void setActivity(preset.emoji, preset.label)}
              whileTap={{ scale: 0.94 }}
              transition={spring.pop}
            >
              <span className="activity-grid__emoji">{preset.emoji}</span>
              <span className="t-xs">{preset.label}</span>
            </motion.button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={inbox} onClose={() => setInbox(false)} label="Recent activity">
        <h2 className="t-h2 sheet__title">What you missed</h2>
        {recent.length === 0 ? (
          <p className="t-sm muted">You're all caught up ✨</p>
        ) : (
          <ul className="inbox">
            {recent.map((event) => (
              <li key={String(event.id)} className="inbox__row">
                <span className="inbox__glyph">
                  {event.kind === 'joined' ? '✨' : event.kind === 'posted' ? '📷' : '🏠'}
                </span>
                <span className="inbox__text truncate">{event.text}</span>
                <span className="t-micro faint">{timeAgo(event.createdAt, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </div>
  );
}

function StackedArt() {
  return (
    <div className="empty-art">
      <span className="empty-art__card" data-i="0" />
      <span className="empty-art__card" data-i="1" />
      <span className="empty-art__card" data-i="2">
        <span>🫖</span>
      </span>
    </div>
  );
}
