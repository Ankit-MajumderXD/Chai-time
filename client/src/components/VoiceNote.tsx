/**
 * Voice notes: the waveform, and the player around it.
 *
 * The shape is measured once at record time and stored as a short string, so a
 * note draws instantly — before a single byte of audio has downloaded. Playing
 * it just fills the bars in.
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { decodeWaveform, formatDuration, placeholderWaveform } from '../lib/audio';
import { spring } from '../design/motion';
import { haptic } from '../lib/haptics';

const SPEEDS = [1, 1.5, 2] as const;

export const Waveform = memo(function Waveform({
  peaks,
  progress = 0,
  live = false,
  onSeek,
  height = 30,
  label,
}: {
  peaks: number[];
  /** 0..1 */
  progress?: number;
  /** Recording: the last bars pulse with the input level. */
  live?: boolean;
  onSeek?: (fraction: number) => void;
  height?: number;
  label?: string;
}) {
  const seek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    onSeek(Math.max(0, Math.min(1, (x - box.left) / box.width)));
  };

  return (
    <div
      className="wave"
      style={{ height }}
      role={onSeek ? 'slider' : undefined}
      aria-label={label ?? (onSeek ? 'Seek within the voice note' : 'Voice waveform')}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      onClick={onSeek ? seek : undefined}
      onTouchStart={onSeek ? seek : undefined}
    >
      {peaks.map((peak, i) => {
        const played = peaks.length > 0 && i / peaks.length <= progress;
        return (
          <span
            key={i}
            className="wave__bar"
            data-played={played}
            data-live={live}
            style={{
              height: `${Math.max(12, peak * 100)}%`,
              animationDelay: live ? `${(i % 8) * 60}ms` : undefined,
            }}
          />
        );
      })}
    </div>
  );
});

interface Props {
  url: string;
  waveform: string;
  durationMs: number;
  seed: string;
  mine?: boolean;
  onDelete?: () => void;
}

export function VoiceNote({ url, waveform, durationMs, seed, mine, onDelete }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [elapsed, setElapsed] = useState(0);

  const peaks = waveform ? decodeWaveform(waveform) : placeholderWaveform(seed);

  const ensure = useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio(url);
      el.preload = 'metadata';
      el.onended = () => {
        setPlaying(false);
        setProgress(0);
        setElapsed(0);
      };
      el.ontimeupdate = () => {
        const total = Number.isFinite(el.duration) && el.duration > 0
          ? el.duration
          : durationMs / 1000;
        setElapsed(el.currentTime * 1000);
        setProgress(total > 0 ? Math.min(1, el.currentTime / total) : 0);
      };
      audioRef.current = el;
    }
    return audioRef.current;
  }, [url, durationMs]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    []
  );

  const toggle = async () => {
    const el = ensure();
    haptic('light');
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    el.playbackRate = speed;
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const onSeek = (fraction: number) => {
    const el = ensure();
    const total =
      Number.isFinite(el.duration) && el.duration > 0 ? el.duration : durationMs / 1000;
    el.currentTime = total * fraction;
    setProgress(fraction);
    setElapsed(total * fraction * 1000);
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
    haptic('light');
  };

  const shown = playing || progress > 0 ? elapsed : durationMs;

  return (
    <div className="voice-note" data-mine={!!mine}>
      <motion.button
        type="button"
        className="voice-note__play"
        onClick={toggle}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        whileTap={{ scale: 0.9 }}
        transition={spring.pop}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <rect x="7.5" y="6" width="3.4" height="12" rx="1.2" fill="currentColor" />
            <rect x="13.1" y="6" width="3.4" height="12" rx="1.2" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <path d="M8.5 5.8 18 12l-9.5 6.2V5.8Z" fill="currentColor" />
          </svg>
        )}
      </motion.button>

      <Waveform peaks={peaks} progress={progress} onSeek={onSeek} height={28} />

      <span className="voice-note__time">{formatDuration(shown)}</span>

      <button
        type="button"
        className="voice-note__speed"
        onClick={cycleSpeed}
        aria-label={`Playback speed ${speed}×`}
      >
        {speed}×
      </button>

      {mine && onDelete && (
        <button
          type="button"
          className="voice-note__delete"
          onClick={onDelete}
          aria-label="Delete this voice note"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <path
              d="M6.5 7.5h11m-8.5 0V6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5m1.5 0V18a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
