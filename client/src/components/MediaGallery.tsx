/**
 * Everything the room has ever shared, in one grid.
 *
 * Photos are thumbnails, videos carry their duration, and voice notes show
 * their waveform — so the grid reads as a shelf of things rather than a wall of
 * grey squares.
 */
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Waveform } from './VoiceNote';
import { spring } from '../design/motion';
import { formatDuration, decodeWaveform, placeholderWaveform } from '../lib/audio';
import { haptic } from '../lib/haptics';
import type { Media } from '../module_bindings/types';

type Filter = 'all' | 'photo' | 'video' | 'voice';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'photo', label: 'Photos' },
  { value: 'video', label: 'Videos' },
  { value: 'voice', label: 'Voice' },
];

export function MediaGallery({
  items,
  onOpen,
  emptyLabel = 'Nothing shared in this room yet.',
}: {
  items: Media[];
  onOpen?: (media: Media) => void;
  emptyLabel?: string;
}) {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(
    () => ({
      all: items.length,
      photo: items.filter((m) => m.kind === 'photo').length,
      video: items.filter((m) => m.kind === 'video').length,
      voice: items.filter((m) => m.kind === 'voice').length,
    }),
    [items]
  );

  const shown = useMemo(
    () => (filter === 'all' ? items : items.filter((m) => m.kind === filter)),
    [items, filter]
  );

  return (
    <div className="gallery">
      <div className="gallery__filters" role="tablist" aria-label="Filter media">
        {FILTERS.map((option) => {
          const active = option.value === filter;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              className="gallery__filter"
              data-active={active}
              onClick={() => {
                haptic('light');
                setFilter(option.value);
              }}
            >
              {active && (
                <motion.span
                  className="gallery__filter-pill"
                  layoutId="gallery-filter"
                  transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                  aria-hidden
                />
              )}
              <span className="gallery__filter-label">
                {option.label}
                {counts[option.value] > 0 && <b>{counts[option.value]}</b>}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="t-sm faint media-grid__empty">
          {filter === 'all'
            ? emptyLabel
            : filter === 'voice'
              ? 'No voice notes yet — hold the mic in Chat to leave one.'
              : `No ${filter}s yet.`}
        </p>
      ) : (
        <div className="media-grid">
          <AnimatePresence initial={false}>
            {shown.map((item, i) => (
              <motion.button
                key={String(item.id)}
                type="button"
                className="media-grid__cell"
                data-kind={item.kind}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ ...spring.gentle, delay: Math.min(i, 8) * 0.02 }}
                onClick={() => onOpen?.(item)}
                whileTap={{ scale: 0.96 }}
                aria-label={
                  item.kind === 'voice'
                    ? `Voice note, ${formatDuration(item.durationMs)}`
                    : item.kind === 'video'
                      ? `Video, ${formatDuration(item.durationMs)}`
                      : 'Photo'
                }
              >
                {item.kind === 'photo' && <img src={item.url} alt="" loading="lazy" />}

                {item.kind === 'video' && (
                  <>
                    <video
                      src={item.url}
                      poster={item.posterUrl || undefined}
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <span className="media-grid__play" aria-hidden>
                      ▶
                    </span>
                    {item.durationMs > 0 && (
                      <span className="media-grid__duration">
                        {formatDuration(item.durationMs)}
                      </span>
                    )}
                  </>
                )}

                {item.kind === 'voice' && (
                  <span className="media-grid__voice">
                    <Waveform
                      peaks={
                        item.waveform
                          ? decodeWaveform(item.waveform)
                          : placeholderWaveform(String(item.id), 20)
                      }
                      height={34}
                    />
                    <b>{formatDuration(item.durationMs)}</b>
                  </span>
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
