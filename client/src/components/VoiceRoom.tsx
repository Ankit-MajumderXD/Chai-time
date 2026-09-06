/**
 * The live voice room.
 *
 * Big faces on a warm ground, a ring that lights up when you speak, and four
 * controls. Explicitly not a conference call: no grid of rectangles, no
 * "participants (5)", no meeting id. Just the people who are around.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { pressable, riseVariants, spring } from '../design/motion';
import { firstName } from '../lib/format';
import type { VoiceControls } from '../data/useVoice';
import type { VoiceView } from '../data/useRoom';

interface Props {
  roomName: string;
  roomEmoji: string;
  mood: string;
  voice: VoiceView;
  controls: VoiceControls;
  onClose: () => void;
  onInvite: () => void;
}

export function VoiceRoom({
  roomName,
  roomEmoji,
  mood,
  voice,
  controls,
  onClose,
  onInvite,
}: Props) {
  const seats = voice.seats;

  return (
    <motion.div
      className="voice-room"
      data-mood={mood}
      variants={riseVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      role="dialog"
      aria-label={`Live voice in ${roomName}`}
    >
      <div className="voice-room__wash" aria-hidden />

      <header className="voice-room__head">
        <motion.button
          type="button"
          className="icon-btn"
          aria-label="Back to the room"
          onClick={onClose}
          {...pressable}
        >
          <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
            <path
              d="M7 10.5 12 15.5l5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
        <div className="voice-room__title">
          <h1 className="t-h3">
            {roomEmoji} {roomName}
          </h1>
          <span className="pill pill--live">
            <span className="dot-live" /> Live voice
          </span>
        </div>
        <span className="topbar__spacer" />
      </header>

      {controls.micDenied && (
        <p className="voice-room__notice t-sm">
          We can't hear you — your microphone is blocked. You can still listen.
        </p>
      )}

      <div className="voice-room__seats">
        <AnimatePresence initial={false}>
          {seats.map((seat) => {
            const name = seat.isMe ? 'You' : firstName(seat.member?.displayName ?? 'Someone');
            const speaking = seat.isMe ? controls.speaking : seat.speaking;
            const muted = seat.isMe ? controls.muted : seat.participant.muted;

            return (
              <motion.div
                key={String(seat.participant.id)}
                className="seat"
                layout
                initial={{ opacity: 0, scale: 0.82 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.82 }}
                transition={spring.bouncy}
              >
                <motion.div
                  className="seat__ring"
                  data-speaking={speaking}
                  animate={
                    speaking
                      ? { scale: [1, 1.045, 1], opacity: 1 }
                      : { scale: 1, opacity: 0.55 }
                  }
                  transition={
                    speaking
                      ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
                      : spring.snappy
                  }
                >
                  <Avatar
                    name={seat.member?.displayName ?? 'Someone'}
                    src={seat.member?.avatarUrl}
                    size={78}
                  />
                  {muted && (
                    <span className="seat__muted" aria-label="Muted">
                      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
                        <path
                          d="M5 5l14 14M9.2 5.6A2.8 2.8 0 0 1 14.8 6v4.2M14.8 14.6a2.8 2.8 0 0 1-5.6-.4V9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  )}
                </motion.div>
                <span className="seat__name truncate">{name}</span>
                <span className="seat__state" data-speaking={speaking}>
                  {muted ? 'Muted' : speaking ? 'Speaking' : 'Listening'}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {seats.length === 1 && (
          <motion.div
            className="seat seat--empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <button className="seat__invite" onClick={onInvite} aria-label="Invite people to voice">
              +
            </button>
            <span className="seat__name">Invite</span>
            <span className="seat__state">Nobody else yet</span>
          </motion.div>
        )}
      </div>

      <footer className="voice-room__controls">
        <VoiceButton
          label={controls.muted ? 'Unmute your microphone' : 'Mute your microphone'}
          caption={controls.muted ? 'Unmute' : 'Mute'}
          active={controls.muted}
          onClick={controls.toggleMute}
        >
          {controls.muted ? '🔇' : '🎤'}
        </VoiceButton>

        <VoiceButton
          label={controls.deafened ? 'Turn the room audio back on' : 'Silence the room audio'}
          caption="Speaker"
          active={controls.deafened}
          onClick={controls.toggleDeafen}
        >
          {controls.deafened ? '🔈' : '🔊'}
        </VoiceButton>

        <motion.button
          type="button"
          className="voice-leave"
          onClick={controls.leave}
          aria-label="Leave the voice room"
          {...pressable}
        >
          <span aria-hidden>📴</span>
          Leave
        </motion.button>

        <VoiceButton label="Invite people to this room" caption="Invite" onClick={onInvite}>
          ＋
        </VoiceButton>
      </footer>
    </motion.div>
  );
}

function VoiceButton({
  label,
  caption,
  active,
  onClick,
  children,
}: {
  label: string;
  caption: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      className="voice-btn"
      data-active={!!active}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      {...pressable}
    >
      <span className="voice-btn__glyph" aria-hidden>
        {children}
      </span>
      <span className="voice-btn__caption">{caption}</span>
    </motion.button>
  );
}
