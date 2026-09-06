/**
 * REPLAY THE ROOM.
 *
 * You missed a few hours. Press play and the room rebuilds itself: people
 * arriving, a photo, a reaction, a voice note, the voice room opening — each
 * beat dropping onto a timeline that scrolls itself. It builds to "⚡ RIGHT
 * NOW", and then THE ROOM COLLISION: every recent moment flies in at once and
 * lands in an overlapping pile. Then you walk into the live room.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { Waveform } from './VoiceNote';
import { spring } from '../design/motion';
import { clockTime, firstName } from '../lib/format';
import { decodeWaveform, placeholderWaveform } from '../lib/audio';
import { haptic } from '../lib/haptics';
import { stillUrl } from '../lib/upload';
import type { ReplayBeat, ReplayData } from '../data/useReplay';

const TEXT_BEAT_MS = 1650;
const RICH_BEAT_MS = 2500;
const NOW_BEAT_MS = 2200;

interface Props {
  open: boolean;
  data: ReplayData;
  roomName: string;
  roomEmoji: string;
  mood: string;
  onEnter: () => void;
}

type Step =
  | { phase: 'story'; i: number }
  | { phase: 'now' }
  | { phase: 'collision' };

export function ReplayRoom({ open, data, roomName, roomEmoji, mood, onEnter }: Props) {
  const beats = data.story;
  const total = beats.length + 2; // + "now" + collision

  const [stepIndex, setStepIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const step: Step = useMemo(() => {
    if (stepIndex < beats.length) return { phase: 'story', i: stepIndex };
    if (stepIndex === beats.length) return { phase: 'now' };
    return { phase: 'collision' };
  }, [stepIndex, beats.length]);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
      setPaused(false);
      haptic('light');
    }
  }, [open]);

  // auto-advance
  useEffect(() => {
    if (!open || paused) return;
    if (step.phase === 'collision') return; // the finale waits for you
    const beat = step.phase === 'story' ? beats[step.i] : undefined;
    const ms =
      step.phase === 'now'
        ? NOW_BEAT_MS
        : beat && (beat.kind === 'moment' || beat.kind === 'prompt')
          ? RICH_BEAT_MS
          : TEXT_BEAT_MS;
    const t = window.setTimeout(() => setStepIndex((n) => Math.min(n + 1, total - 1)), ms);
    return () => window.clearTimeout(t);
  }, [open, paused, step, stepIndex, beats, total]);

  // keep the newest beat in view
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [stepIndex]);

  useEffect(() => {
    if (step.phase !== 'story') haptic(step.phase === 'collision' ? 'heavy' : 'medium');
  }, [step.phase]);

  const next = useCallback(
    () => setStepIndex((n) => Math.min(n + 1, total - 1)),
    [total]
  );
  const prev = useCallback(() => setStepIndex((n) => Math.max(n - 1, 0)), []);

  const onTapZone = (e: React.MouseEvent) => {
    const x = e.clientX / window.innerWidth;
    if (x < 0.32) prev();
    else next();
  };

  if (!open) return null;

  const shownBeats = beats.slice(0, step.phase === 'story' ? step.i + 1 : beats.length);
  const progress = (stepIndex + 1) / total;

  return (
    <motion.div
      className="replay"
      data-mood={mood}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="replay__bar">
        <span className="replay__progress" style={{ transform: `scaleX(${progress})` }} />
      </div>

      <header className="replay__head">
        <div>
          <p className="replay__kicker">Replaying</p>
          <h2 className="replay__title">
            {roomEmoji} {roomName}
          </h2>
        </div>
        <button
          type="button"
          className="replay__skip"
          onClick={() => {
            haptic('light');
            onEnter();
          }}
        >
          Skip
        </button>
      </header>

      <div className="replay__stage" onClick={onTapZone} ref={scrollRef}>
        {step.phase !== 'collision' && (
          <ul className="replay__timeline">
            <AnimatePresence initial={false}>
              {shownBeats.map((beat) => (
                <BeatRow key={beat.id} beat={beat} />
              ))}
              {step.phase === 'now' && (
                <motion.li
                  key="now"
                  className="replay__now"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={spring.pop}
                >
                  <span className="replay__now-bolt">⚡</span>
                  <span>RIGHT NOW</span>
                </motion.li>
              )}
            </AnimatePresence>
          </ul>
        )}

        {step.phase === 'collision' && (
          <Collision moments={data.collision} />
        )}
      </div>

      <footer className="replay__foot">
        {step.phase === 'collision' ? (
          <motion.button
            type="button"
            className="btn btn--primary btn--block"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...spring.gentle, delay: 0.8 }}
            onClick={() => {
              haptic('success');
              onEnter();
            }}
          >
            Enter the room →
          </motion.button>
        ) : (
          <div className="replay__controls">
            <button type="button" className="replay__ctrl" onClick={prev} aria-label="Back">
              ‹
            </button>
            <button
              type="button"
              className="replay__ctrl replay__ctrl--play"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Play' : 'Pause'}
            >
              {paused ? '▶' : 'll'}
            </button>
            <button type="button" className="replay__ctrl" onClick={next} aria-label="Forward">
              ›
            </button>
          </div>
        )}
      </footer>
    </motion.div>
  );
}

/* ------------------------------------------------------------- one beat --- */

function BeatRow({ beat }: { beat: ReplayBeat }) {
  return (
    <motion.li
      className="beat"
      data-kind={beat.kind}
      layout
      initial={{ opacity: 0, y: 26, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.gentle}
    >
      <span className="beat__time">{clockTime(beat.atMillis)}</span>

      <div className="beat__body">
        {beat.kind === 'online' && (
          <div className="beat__line">
            <span className="beat__avatar beat__avatar--pulse">
              <Avatar name={beat.member?.displayName ?? '?'} src={beat.member?.avatarUrl} size={30} />
            </span>
            <span>
              <b>{firstName(beat.member?.displayName ?? 'Someone')}</b> came online <span className="beat__dot">🟢</span>
            </span>
          </div>
        )}

        {beat.kind === 'joined' && (
          <div className="beat__line">
            <Avatar name={beat.member?.displayName ?? '?'} src={beat.member?.avatarUrl} size={30} />
            <span>{beat.text} ✨</span>
          </div>
        )}

        {beat.kind === 'reaction' && (
          <div className="beat__line">
            <Avatar name={beat.member?.displayName ?? '?'} src={beat.member?.avatarUrl} size={26} />
            <span>
              <b>{firstName(beat.member?.displayName ?? 'Someone')}</b> reacted
            </span>
            <motion.span
              className="beat__reaction"
              initial={{ scale: 0.2, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={spring.pop}
            >
              {beat.emoji ?? '❤️'}
            </motion.span>
          </div>
        )}

        {beat.kind === 'voice' && (
          <div className="beat__line">
            <span className="beat__glyph">🎙️</span>
            <span>{beat.text}</span>
          </div>
        )}

        {beat.kind === 'prompt' && (
          <div className="beat__prompt">
            <span className="beat__glyph">🗣️</span>
            <span>“{beat.text}”</span>
          </div>
        )}

        {beat.kind === 'moment' && beat.moment && (
          <div className="beat__moment">
            <div className="beat__line">
              <Avatar
                name={beat.moment.author?.displayName ?? '?'}
                src={beat.moment.author?.avatarUrl}
                size={26}
              />
              <span>
                <b>{firstName(beat.moment.author?.displayName ?? 'Someone')}</b>{' '}
                {beat.moment.moment.kind === 'voice' ? 'sent a voice note 🎤' : 'shared a moment 📷'}
              </span>
            </div>
            {beat.moment.moment.kind === 'voice' ? (
              <div className="beat__voice">
                <Waveform
                  peaks={
                    beat.moment.media?.waveform
                      ? decodeWaveform(beat.moment.media.waveform)
                      : placeholderWaveform(String(beat.moment.moment.id))
                  }
                  height={26}
                />
              </div>
            ) : (
              beat.moment.media && stillUrl(beat.moment.media) && (
                <motion.img
                  className="beat__photo"
                  src={stillUrl(beat.moment.media)}
                  alt=""
                  initial={{ scale: 1.12, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                />
              )
            )}
            {beat.moment.moment.caption && (
              <p className="beat__caption">{beat.moment.moment.caption}</p>
            )}
          </div>
        )}
      </div>
    </motion.li>
  );
}

/* ------------------------------------------------------- the collision --- */

function Collision({ moments }: { moments: ReplayData['collision'] }) {
  useEffect(() => {
    haptic('heavy');
  }, []);

  const from = [
    { x: '-70vw', y: '-40vh', r: -18 },
    { x: '75vw', y: '-30vh', r: 14 },
    { x: '-60vw', y: '50vh', r: 10 },
    { x: '80vw', y: '45vh', r: -12 },
    { x: '0vw', y: '-70vh', r: 6 },
  ];
  const rest = [
    { x: -46, y: -30, r: -9 },
    { x: 44, y: -14, r: 8 },
    { x: -30, y: 40, r: 6 },
    { x: 40, y: 46, r: -7 },
    { x: 4, y: 12, r: 3 },
  ];

  return (
    <div className="collision">
      <motion.p
        className="collision__label"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...spring.pop, delay: 0.1 }}
      >
        💥 THE ROOM COLLISION
      </motion.p>

      <div className="collision__stack">
        {moments.map((v, i) => (
          <motion.div
            key={String(v.moment.id)}
            className="collision__card"
            initial={{
              x: from[i % from.length].x,
              y: from[i % from.length].y,
              rotate: from[i % from.length].r * 3,
              opacity: 0,
              scale: 0.6,
            }}
            animate={{
              x: rest[i % rest.length].x,
              y: rest[i % rest.length].y,
              rotate: rest[i % rest.length].r,
              opacity: 1,
              scale: 1,
            }}
            transition={{ ...spring.bouncy, delay: 0.25 + i * 0.12 }}
          >
            {v.media && stillUrl(v.media) ? (
              <img src={stillUrl(v.media)} alt="" />
            ) : (
              <div className="collision__voice">
                🎤
                <Waveform
                  peaks={
                    v.media?.waveform
                      ? decodeWaveform(v.media.waveform)
                      : placeholderWaveform(String(v.moment.id))
                  }
                  height={18}
                />
              </div>
            )}
            <span className="collision__by">
              <Avatar name={v.author?.displayName ?? '?'} src={v.author?.avatarUrl} size={20} />
              {firstName(v.author?.displayName ?? '')}
            </span>
          </motion.div>
        ))}
      </div>

      <motion.p
        className="collision__sub"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        {moments.length} moment{moments.length === 1 ? '' : 's'}, all at once
      </motion.p>
    </div>
  );
}
