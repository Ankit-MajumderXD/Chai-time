/**
 * The composer.
 *
 * One bar, four ways in: camera, keyboard, microphone, attachments. Text is
 * always available and always instant — media is an option, never a toll.
 *
 * The microphone is the interesting one: tap to arm, or press and hold to
 * record. While holding, sliding left past a threshold cancels — the gesture
 * everyone already knows from every messaging app, without the app around it.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Waveform } from './VoiceNote';
import { BottomSheet } from './Overlay';
import { EmojiPopover } from './EmojiPopover';
import { pressable, spring } from '../design/motion';
import { formatDuration, VoiceRecorder } from '../lib/audio';
import { haptic } from '../lib/haptics';
import { putMedia, tooBig, type MediaRef } from '../lib/upload';

const CANCEL_DISTANCE = 90;
const MIN_VOICE_MS = 600;
const MAX_VOICE_MS = 120_000;

export interface ComposerProps {
  placeholder?: string;
  onSendText: (text: string) => void;
  onSendVoice: (media: MediaRef) => void;
  onPickMedia: (file: File) => void;
  onOpenCamera: () => void;
  onTyping: () => void;
  onError: (message: string) => void;
  /** Rendered above the input — the typing indicator lives here. */
  hint?: React.ReactNode;
  /** When replying to a moment, what is being replied to. */
  quote?: { label: string; onClear: () => void };
  disabled?: boolean;
}

export function Composer({
  placeholder = "What's happening?",
  onSendText,
  onSendVoice,
  onPickMedia,
  onOpenCamera,
  onTyping,
  onError,
  hint,
  quote,
  disabled,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [attachments, setAttachments] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const recorder = useRef<VoiceRecorder | null>(null);
  const startX = useRef(0);
  const cancelled = useRef(false);
  /** Mirrors `cancelling` for the window listeners, which close over refs. */
  const cancelling_ = useRef(false);
  const release = useRef<(() => void) | null>(null);
  const ticker = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSend = text.trim().length > 0;

  useEffect(
    () => () => {
      window.clearInterval(ticker.current);
      release.current?.();
      recorder.current?.cancel();
    },
    []
  );

  /* ---- text ------------------------------------------------------------- */

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;
    onSendText(body);
    setText('');
    haptic('light');
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next.slice(0, 600));
    onTyping();
    haptic('light');
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + emoji.length;
      el?.setSelectionRange(caret, caret);
    });
  };

  /* ---- voice ------------------------------------------------------------ */

  const beginRecording = async () => {
    if (recording || busy || disabled) return;
    cancelled.current = false;
    const rec = new VoiceRecorder();
    recorder.current = rec;

    try {
      await rec.start((level) => setLevels((current) => [...current.slice(-47), level]));
    } catch {
      recorder.current = null;
      onError("We can't reach your microphone — check the permission and try again.");
      return;
    }

    haptic('medium');
    setLevels([]);
    setElapsed(0);
    setRecording(true);
    ticker.current = window.setInterval(() => {
      const ms = rec.elapsedMs;
      setElapsed(ms);
      if (ms > MAX_VOICE_MS) void finishRecording();
    }, 100);
  };

  const finishRecording = async () => {
    const rec = recorder.current;
    window.clearInterval(ticker.current);
    setRecording(false);
    setCancelling(false);
    if (!rec) return;
    recorder.current = null;

    if (cancelled.current) {
      rec.cancel();
      haptic('light');
      return;
    }

    setBusy(true);
    try {
      const result = await rec.stop();
      if (!result || result.durationMs < MIN_VOICE_MS) {
        onError('Hold the mic a little longer to record.');
        return;
      }
      const media = await putMedia(result.blob, 'voice', {
        durationMs: result.durationMs,
        waveform: result.waveform,
        mimeType: result.mimeType,
      });
      if (tooBig(media)) {
        onError('That note is a bit long — try a shorter one.');
        return;
      }
      haptic('success');
      onSendVoice(media);
    } catch {
      onError("That recording didn't save. Give it another go.");
    } finally {
      setBusy(false);
      setLevels([]);
      setElapsed(0);
    }
  };

  const cancelRecording = () => {
    cancelled.current = true;
    void finishRecording();
  };

  /**
   * The gesture is tracked on `window`, not on the button.
   *
   * The moment recording starts the composer swaps the mic out for the
   * recording strip — so the element the finger is on is gone, and any
   * pointerup bound to it would never fire. Listening globally means the
   * release is caught wherever the finger happens to be, which is also what
   * makes slide-to-cancel work at all.
   */
  const onPointerDown = (e: React.PointerEvent) => {
    if (recording || busy || disabled) return;
    startX.current = e.clientX;
    cancelling_.current = false;
    setCancelling(false);

    const move = (ev: PointerEvent) => {
      const dragged = startX.current - ev.clientX;
      const wantsCancel = dragged > CANCEL_DISTANCE;
      cancelling_.current = wantsCancel;
      setCancelling(wantsCancel);
    };
    const up = () => {
      detach();
      if (cancelling_.current) cancelRecording();
      else void finishRecording();
    };
    const abort = () => {
      detach();
      cancelRecording();
    };
    const detach = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', abort);
      release.current = null;
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', abort);
    release.current = detach;

    void beginRecording();
  };

  return (
    <div className="composer">
      <AnimatePresence>{hint}</AnimatePresence>

      <AnimatePresence>
        {quote && (
          <motion.div
            className="composer__quote"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring.snappy}
          >
            <span className="truncate">↩ {quote.label}</span>
            <button type="button" onClick={quote.onClear} aria-label="Stop replying">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="composer__bar glass">
        <AnimatePresence mode="wait" initial={false}>
          {recording ? (
            <motion.div
              key="recording"
              className="composer__recording"
              data-cancelling={cancelling}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={spring.snappy}
            >
              <span className="composer__rec-dot" aria-hidden />
              <span className="composer__rec-time">{formatDuration(elapsed)}</span>
              <Waveform peaks={levels} live height={24} label="Recording level" />
              <span className="composer__rec-hint">
                {cancelling ? 'Release to cancel' : '‹ slide to cancel'}
              </span>
            </motion.div>
          ) : (
            <motion.form
              key="idle"
              className="composer__form"
              onSubmit={submit}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={spring.snappy}
            >
              <motion.button
                type="button"
                className="composer__icon"
                aria-label="Open camera"
                onClick={onOpenCamera}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setAttachments(true);
                }}
                disabled={disabled}
                {...pressable}
              >
                <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden>
                  <path
                    d="M4.6 8.4h2.9l1.4-2.1h6.2l1.4 2.1h2.9A1.6 1.6 0 0 1 21 10v7.6a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.6V10a1.6 1.6 0 0 1 1.6-1.6Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="13.6" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              </motion.button>

              <input
                ref={inputRef}
                className="composer__field"
                value={text}
                placeholder={busy ? 'Sending…' : placeholder}
                aria-label="Message"
                disabled={disabled || busy}
                onChange={(e) => {
                  setText(e.target.value);
                  onTyping();
                }}
                maxLength={600}
              />

              <span className="emoji-anchor">
                <motion.button
                  type="button"
                  className="composer__icon"
                  aria-label="Add an emoji"
                  aria-expanded={emojiOpen}
                  onClick={() => setEmojiOpen((v) => !v)}
                  disabled={disabled}
                  {...pressable}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                    <circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
                    <circle cx="9.2" cy="10.4" r="1.15" fill="currentColor" />
                    <circle cx="14.8" cy="10.4" r="1.15" fill="currentColor" />
                    <path
                      d="M8.4 14.2a4.4 4.4 0 0 0 7.2 0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </motion.button>
                <EmojiPopover
                  open={emojiOpen}
                  onClose={() => setEmojiOpen(false)}
                  onPick={insertEmoji}
                  align="right"
                />
              </span>

              <motion.button
                type="button"
                className="composer__icon composer__icon--more"
                aria-label="Add an attachment"
                onClick={() => setAttachments(true)}
                disabled={disabled}
                {...pressable}
              >
                <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
                  <path
                    d="M12 6.4v11.2M6.4 12h11.2"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                  />
                </svg>
              </motion.button>

              <AnimatePresence mode="wait" initial={false}>
                {canSend ? (
                  <motion.button
                    key="send"
                    type="submit"
                    className="composer__send"
                    aria-label="Send message"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={spring.pop}
                  >
                    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
                      <path d="M4.4 11.9 19.2 5.2 13.6 20l-2.4-6.1-6.8-2Z" fill="currentColor" />
                    </svg>
                  </motion.button>
                ) : (
                  <motion.button
                    key="mic"
                    type="button"
                    className="composer__mic"
                    aria-label="Hold to record a voice note"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={spring.pop}
                    whileTap={{ scale: 1.12 }}
                    disabled={disabled || busy}
                    onPointerDown={onPointerDown}
                  >
                    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
                      <rect
                        x="9"
                        y="3.6"
                        width="6"
                        height="10.4"
                        rx="3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M5.8 11.8a6.2 6.2 0 0 0 12.4 0M12 18v2.6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <BottomSheet
        open={attachments}
        onClose={() => setAttachments(false)}
        label="Add to this room"
      >
        <h2 className="t-h2 sheet__title">Add something</h2>
        <div className="sheet__actions">
          <button
            className="sheet__action"
            onClick={() => {
              setAttachments(false);
              onOpenCamera();
            }}
          >
            <span>📷</span> Take a photo or video
          </button>
          <button
            className="sheet__action"
            onClick={() => {
              setAttachments(false);
              fileRef.current?.click();
            }}
          >
            <span>🖼️</span> Choose from gallery
          </button>
          <button
            className="sheet__action"
            onClick={() => {
              setAttachments(false);
              inputRef.current?.focus();
            }}
          >
            <span>🎤</span> Voice note — hold the mic instead
          </button>
        </div>
        <p className="t-xs faint">
          🔒 Everything here stays inside this room.
        </p>
      </BottomSheet>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPickMedia(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** "Mom is typing…" — three dots that actually animate. */
export function TypingHint({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names.length} people are typing`;

  return (
    <motion.div
      className="typing"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={spring.snappy}
    >
      <span className="typing__dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="t-xs muted">{label}…</span>
    </motion.div>
  );
}
