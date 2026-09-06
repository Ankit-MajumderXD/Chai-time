/**
 * The Live tab — the answer to "who is here and what are they doing".
 *
 * This is the top of the room's hierarchy on purpose: people first, then voice,
 * then everything else. It is the screen that should make you say "oh, everyone
 * is around".
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { BottomSheet } from './Overlay';
import { EmojiPopover } from './EmojiPopover';
import { StreakFlame } from './StreakFlame';
import { TodaysTitles } from './TodaysTitles';
import { itemVariants, listVariants, pressable, spring } from '../design/motion';
import { firstName, shortTimeAgo } from '../lib/format';
import { ACTIVITY_PRESETS } from '../lib/rooms';
import { haptic } from '../lib/haptics';
import { useNow } from '../data/useNow';
import type { RoomMember } from '../module_bindings/types';
import type { RoomTitleView, VoiceView } from '../data/useRoom';

interface Props {
  members: RoomMember[];
  me: RoomMember | undefined;
  viewing: RoomMember[];
  voice: VoiceView;
  titles: RoomTitleView[];
  isEvent: boolean;
  momentCount: number;
  onSetActivity: (emoji: string, label: string) => void;
  onOpenVoice: () => void;
  onStartVoice: () => void;
  onInvite: () => void;
}

export function LiveTab({
  members,
  me,
  viewing,
  voice,
  titles,
  isEvent,
  momentCount,
  onSetActivity,
  onOpenVoice,
  onStartVoice,
  onInvite,
}: Props) {
  const [picker, setPicker] = useState(false);
  const now = useNow(30_000);

  // Me first, then whoever is most present — the room should read like a room.
  const ordered = [...members].sort((a, b) => {
    if (a.id === me?.id) return -1;
    if (b.id === me?.id) return 1;
    return 0;
  });

  const online = members.filter((m) => m.status === 'online').length;

  return (
    <div className="live-tab">
      {isEvent && (
        <motion.div
          className="event-banner"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.gentle}
        >
          <span className="pill pill--live event-banner__pill">
            <span className="dot-live" /> Live event
          </span>
          <div className="event-banner__stats">
            <span>
              <b>{online}</b> here
            </span>
            <span>
              <b>{momentCount}</b> moments
            </span>
            <span>
              <b>{voice.seats.length}</b> on voice
            </span>
          </div>
        </motion.div>
      )}

      {/* ---- Live voice ------------------------------------------------- */}
      <motion.div
        className="voice-cta"
        data-live={voice.live}
        variants={itemVariants}
        initial="initial"
        animate="animate"
      >
        <div className="voice-cta__text">
          <p className="t-body-strong">
            {voice.live ? 'Live voice room' : 'Talk to everyone'}
          </p>
          <p className="t-xs muted">
            {voice.live
              ? `${voice.seats.length} ${voice.seats.length === 1 ? 'person is' : 'people are'} on voice`
              : 'Start a voice room — no ringing, people just drop in'}
          </p>
        </div>

        {voice.live && (
          <div className="voice-cta__faces">
            {voice.seats.slice(0, 3).map((seat) => (
              <Avatar
                key={String(seat.participant.id)}
                name={seat.member?.displayName ?? 'Someone'}
                src={seat.member?.avatarUrl}
                size={28}
              />
            ))}
          </div>
        )}

        <motion.button
          type="button"
          className={`btn btn--sm ${voice.live ? 'btn--primary' : 'btn--tinted'}`}
          onClick={() => {
            haptic('medium');
            if (voice.live) onOpenVoice();
            else onStartVoice();
          }}
          {...pressable}
        >
          {voice.iAmIn ? 'Back to voice' : voice.live ? 'Join' : 'Start'}
        </motion.button>
      </motion.div>

      {/* ---- Your status ------------------------------------------------ */}
      <motion.button
        type="button"
        className="status-card"
        onClick={() => setPicker(true)}
        variants={itemVariants}
        initial="initial"
        animate="animate"
        {...pressable}
      >
        <Avatar name={me?.displayName ?? 'You'} src={me?.avatarUrl} size={40} presence="online" />
        <span className="status-card__text">
          <span className="t-xs muted">You</span>
          <span className="t-body-strong truncate">
            {me?.activityEmoji ? `${me.activityEmoji} ` : ''}
            {me?.activity || "Set what you're up to"}
          </span>
        </span>
        <span className="status-card__cta t-micro">Change</span>
      </motion.button>

      {/* ---- Today's Titles ------------------------------------------- */}
      <TodaysTitles titles={titles} />

      {/* ---- Live now --------------------------------------------------- */}
      <div className="section-head live-tab__head">
        <h2 className="t-h3">Live now</h2>
        <span className="t-xs faint">
          {online} of {members.length} around
        </span>
      </div>

      <motion.div
        className="presence-grid"
        variants={listVariants}
        initial="initial"
        animate="animate"
      >
        <AnimatePresence initial={false}>
          {ordered.map((member) => {
            const isMe = member.id === me?.id;
            const presence = (member.status as 'online' | 'away' | 'offline') ?? 'offline';
            const onVoice = voice.seats.some((s) => s.participant.memberId === member.id);
            return (
              <motion.div
                key={String(member.id)}
                className="presence-cell"
                data-presence={presence}
                layout
                variants={itemVariants}
                initial="initial"
                animate="animate"
                exit={{ opacity: 0, scale: 0.9 }}
                transition={spring.gentle}
              >
                <div className="presence-cell__ring" data-presence={presence}>
                  <Avatar
                    name={member.displayName}
                    src={member.avatarUrl}
                    size={68}
                    presence={presence}
                    badge={member.activityEmoji || undefined}
                  />
                  {onVoice && (
                    <span className="presence-cell__voice" aria-label="On voice">
                      🎙️
                    </span>
                  )}
                </div>
                <span className="presence-cell__name truncate">
                  {isMe ? 'You' : firstName(member.displayName)}
                  {member.currentStreak > 0 && (
                    <StreakFlame count={member.currentStreak} size={13} className="presence-cell__streak" />
                  )}
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={member.activity || presence}
                    className="presence-cell__activity truncate"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    {member.activity ||
                      (presence === 'online'
                        ? 'Online'
                        : presence === 'away'
                          ? `Away · ${shortTimeAgo(member.lastSeenAt, now)}`
                          : 'Offline')}
                  </motion.span>
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {viewing.length > 0 && (
        <motion.div
          className="viewing-line t-xs muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="viewing-line__faces">
            {viewing.slice(0, 3).map((m) => (
              <Avatar key={String(m.id)} name={m.displayName} src={m.avatarUrl} size={18} />
            ))}
          </span>
          {viewing.length === 1
            ? `${firstName(viewing[0].displayName)} is here with you`
            : viewing.length === 2
              ? `${firstName(viewing[0].displayName)} and ${firstName(viewing[1].displayName)} are here with you`
              : `${viewing.length} people are here with you`}
        </motion.div>
      )}

      <motion.button
        className="btn btn--soft btn--block live-tab__invite"
        onClick={onInvite}
        {...pressable}
      >
        ✨ Bring more people in
      </motion.button>

      <p className="t-xs faint live-tab__privacy">🔒 Private room · only these people can see it</p>

      <ActivityPicker
        open={picker}
        current={me?.activity ?? ''}
        onClose={() => setPicker(false)}
        onPick={(emoji, label) => {
          setPicker(false);
          onSetActivity(emoji, label);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------- Activity picker -- */

export function ActivityPicker({
  open,
  current,
  onClose,
  onPick,
}: {
  open: boolean;
  current: string;
  onClose: () => void;
  onPick: (emoji: string, label: string) => void;
}) {
  const [custom, setCustom] = useState('');
  const [customEmoji, setCustomEmoji] = useState('✍️');
  const [emojiOpen, setEmojiOpen] = useState(false);

  return (
    <BottomSheet open={open} onClose={onClose} label="Set your activity">
      <h2 className="t-h2 sheet__title">What are you up to?</h2>
      <p className="t-sm muted">Your people see this next to your name. No typing required.</p>

      <div className="activity-grid">
        {ACTIVITY_PRESETS.map((preset) => (
          <motion.button
            key={preset.label}
            type="button"
            className="activity-grid__item"
            data-selected={preset.label === current}
            onClick={() => {
              haptic('light');
              onPick(preset.emoji, preset.label === 'Around' ? '' : preset.label);
            }}
            whileTap={{ scale: 0.94 }}
            transition={spring.pop}
          >
            <span className="activity-grid__emoji">{preset.emoji}</span>
            <span className="t-xs">{preset.label}</span>
          </motion.button>
        ))}
      </div>

      <form
        className="activity-custom"
        onSubmit={(e) => {
          e.preventDefault();
          const value = custom.trim();
          if (!value) return;
          onPick(customEmoji, value);
          setCustom('');
        }}
      >
        <span className="emoji-anchor">
          <motion.button
            type="button"
            className="activity-custom__emoji"
            aria-label="Pick an emoji for your status"
            onClick={() => setEmojiOpen((v) => !v)}
            {...pressable}
          >
            {customEmoji}
          </motion.button>
          <EmojiPopover
            open={emojiOpen}
            onClose={() => setEmojiOpen(false)}
            onPick={(emoji) => setCustomEmoji(emoji)}
            align="left"
          />
        </span>
        <input
          className="input input--flush"
          placeholder="Or say it yourself — “making biryani”"
          value={custom}
          maxLength={48}
          onChange={(e) => setCustom(e.target.value)}
          aria-label="Custom status"
        />
        <motion.button
          type="submit"
          className="btn btn--primary btn--sm"
          disabled={!custom.trim()}
          {...pressable}
        >
          Set
        </motion.button>
      </form>
    </BottomSheet>
  );
}
