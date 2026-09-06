/**
 * Create a room.
 *
 * Three decisions, one screen, no wizard: what it's called, who it's for, and
 * (implicitly) that it's private. The mood you pick immediately repaints the
 * screen, so you can see the room before it exists.
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TopBar } from '../components/TopBar';
import { useToast } from '../components/Toast';
import { itemVariants, listVariants, pressable, spring } from '../design/motion';
import { ROOM_MOODS, coverFor, type RoomKind } from '../lib/rooms';
import { generateCode } from '../lib/codes';
import { haptic } from '../lib/haptics';
import { useRouter } from '../lib/router';
import { call, useConn } from '../data/db';

const NAME_IDEAS: Record<RoomKind, string> = {
  friends: 'Weekend Crew',
  family: 'Family',
  trip: 'Goa Trip',
  event: "Sara's Birthday",
  college: 'College Friends',
  other: 'Our Room',
};

export function CreateRoom() {
  const { back, go } = useRouter();
  const conn = useConn();
  const toast = useToast();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<RoomKind>('friends');
  const [creating, setCreating] = useState(false);

  const mood = useMemo(() => ROOM_MOODS.find((m) => m.kind === kind)!, [kind]);
  const previewCover = useMemo(() => coverFor(kind, 'preview'), [kind]);
  const finalName = name.trim() || NAME_IDEAS[kind];

  const create = async () => {
    if (!conn || creating) return;
    setCreating(true);
    haptic('success');

    // A code collision is rare but cheap to retry — the code is generated here
    // because reducers can't hand one back.
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = generateCode();
      const ok = await call(
        conn.reducers.createRoom({
          code,
          name: finalName,
          emoji: mood.emoji,
          kind,
          coverUrl: coverFor(kind, code),
          isEvent: kind === 'event',
        }),
        attempt === 3 ? (message) => toast({ message, tone: 'error', emoji: '⚠️' }) : undefined
      );
      if (ok) {
        toast({ message: `${finalName} is live`, emoji: mood.emoji });
        go({ name: 'invite', code }, { replace: true });
        return;
      }
    }
    setCreating(false);
  };

  return (
    <div className="screen create-screen" data-mood={kind}>
      <TopBar title="Create a room" onBack={back} />

      <div className="gutter stack create-screen__body">
        <motion.div
          className="create-cover"
          key={kind}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring.bouncy}
        >
          <img src={previewCover} alt="" />
          <span className="create-cover__scrim" aria-hidden />
          <span className="create-cover__emoji">{mood.emoji}</span>
          <span className="create-cover__hint t-micro">Tap a vibe to change the cover</span>
        </motion.div>

        <div className="field">
          <label className="field__label" htmlFor="room-name">
            Room name
          </label>
          <input
            id="room-name"
            className="input"
            placeholder={NAME_IDEAS[kind]}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <span className="field__label">Who's this for?</span>
          <motion.div
            className="stack"
            style={{ gap: 'var(--s-2)' }}
            variants={listVariants}
            initial="initial"
            animate="animate"
          >
            {ROOM_MOODS.map((option) => (
              <motion.button
                key={option.kind}
                type="button"
                className="opt-row"
                data-mood={option.kind}
                data-selected={option.kind === kind}
                variants={itemVariants}
                onClick={() => {
                  haptic('light');
                  setKind(option.kind);
                }}
                whileTap={{ scale: 0.985 }}
              >
                <span className="opt-row__glyph">{option.emoji}</span>
                <span className="stack">
                  <span className="t-body-strong">{option.label}</span>
                  <span className="t-xs muted">{option.blurb}</span>
                </span>
                {option.kind === kind && (
                  <motion.span
                    className="opt-row__check"
                    layoutId="opt-check"
                    transition={spring.bouncy}
                  >
                    ✓
                  </motion.span>
                )}
              </motion.button>
            ))}
          </motion.div>
        </div>

        <div className="privacy-note">
          <span className="privacy-note__lock">🔒</span>
          <div>
            <p className="t-body-strong">Private</p>
            <p className="t-xs muted">
              Invite only. Nothing here is public, searchable or algorithmic.
            </p>
          </div>
        </div>

        {kind === 'event' && (
          <div className="privacy-note privacy-note--event">
            <span className="privacy-note__lock">🎉</span>
            <div>
              <p className="t-body-strong">Event mode is on</p>
              <p className="t-xs muted">
                A live banner, people counts and a louder feed. You can turn it off later.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="sticky-foot gutter">
        <motion.button
          className="btn btn--primary btn--block"
          onClick={create}
          disabled={creating}
          {...pressable}
        >
          {creating ? 'Making the room…' : 'Create room'}
        </motion.button>
      </div>
    </div>
  );
}
