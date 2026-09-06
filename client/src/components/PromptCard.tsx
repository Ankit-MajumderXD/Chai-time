/**
 * The live room prompt.
 *
 * When a schedule fires (or the owner sends one), the room gets a prompt like
 * "Aaj ka khaana dikhao na!". It sits at the top of the feed with a way to
 * answer it (the camera) and a way to clear it.
 */
import { motion } from 'framer-motion';
import { spring } from '../design/motion';
import { haptic } from '../lib/haptics';
import type { RoomPrompt } from '../module_bindings/types';

interface Props {
  prompt: RoomPrompt;
  onRespond: () => void;
  onDismiss: () => void;
}

export function PromptCard({ prompt, onRespond, onDismiss }: Props) {
  return (
    <motion.div
      className="prompt-card"
      layout
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96, transition: { duration: 0.16 } }}
      transition={spring.bouncy}
    >
      <button
        type="button"
        className="prompt-card__close"
        onClick={() => {
          haptic('light');
          onDismiss();
        }}
        aria-label="Dismiss prompt"
      >
        ✕
      </button>

      <p className="prompt-card__kicker">
        <span className="prompt-card__pulse" aria-hidden /> Prompt for the room
      </p>
      <p className="prompt-card__text">{prompt.text}</p>

      <motion.button
        type="button"
        className="prompt-card__cta"
        onClick={() => {
          haptic('medium');
          onRespond();
        }}
        whileTap={{ scale: 0.96 }}
        transition={spring.snappy}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
          <path
            d="M4.6 8.4h2.9l1.4-2.1h6.2l1.4 2.1h2.9A1.6 1.6 0 0 1 21 10v7.6a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.6V10a1.6 1.6 0 0 1 1.6-1.6Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="13.6" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
        Respond
      </motion.button>
    </motion.div>
  );
}
