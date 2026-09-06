/**
 * Avatar picker.
 *
 * Three ways to get a face:
 *   Photos      a curated set of real portraits
 *   Characters  generated illustrated avatars (DiceBear) — endless variety,
 *               one tap to reshuffle
 *   Upload      your own photo, downscaled and stored like any other media
 *
 * Whatever the source, the result is a single URL string handed back through
 * `onChange`; the rest of the app never has to care where it came from.
 */
import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { spring } from '../design/motion';
import { haptic } from '../lib/haptics';
import { preparePhoto, putMedia } from '../lib/upload';

const PHOTO_FACES = [31, 12, 45, 60, 5, 20, 33, 9, 26, 47, 15, 68, 3, 51, 24, 39];

const CHARACTER_STYLES = [
  'adventurer',
  'big-smile',
  'fun-emoji',
  'lorelei',
  'micah',
  'notionists',
  'open-peeps',
  'thumbs',
] as const;

function photoUrl(id: number, size = 240) {
  return `https://i.pravatar.cc/${size}?img=${id}`;
}

function characterUrl(style: string, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

type Tab = 'photos' | 'characters' | 'upload';

interface Props {
  name: string;
  value: string;
  onChange: (url: string) => void;
  onError?: (message: string) => void;
}

export function AvatarPicker({ name, value, onChange, onError }: Props) {
  const [tab, setTab] = useState<Tab>('photos');
  const [uploading, setUploading] = useState(false);
  const [seedNudge, setSeedNudge] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // A rotating pool of character seeds; the reshuffle button bumps `seedNudge`.
  const characters = useMemo(
    () =>
      CHARACTER_STYLES.map((style, i) => ({
        style,
        url: characterUrl(style, `${name || 'chai'}-${i}-${seedNudge}`),
      })),
    [name, seedNudge]
  );

  const pickFile = async (file: File) => {
    setUploading(true);
    try {
      const { blob, width, height } = await preparePhoto(file);
      const ref = await putMedia(blob, 'photo', { width, height });
      onChange(ref.url);
      haptic('success');
    } catch (err: any) {
      onError?.(err?.message ?? "That photo didn't work — try another.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="avatar-picker">
      <div className="avatar-picker__preview">
        <Avatar name={name || 'You'} src={value} size={84} ring presence="online" />
      </div>

      <div className="avatar-picker__tabs" role="tablist">
        {(['photos', 'characters', 'upload'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className="avatar-picker__tab"
            data-active={tab === t}
            onClick={() => {
              haptic('light');
              setTab(t);
            }}
          >
            {t === 'photos' ? 'Photos' : t === 'characters' ? 'Characters' : 'Upload'}
          </button>
        ))}
      </div>

      {tab === 'photos' && (
        <div className="avatar-picker__grid">
          {PHOTO_FACES.map((id) => {
            const url = photoUrl(id);
            return (
              <motion.button
                key={id}
                type="button"
                className="avatar-picker__item"
                data-selected={value === url}
                onClick={() => {
                  haptic('light');
                  onChange(url);
                }}
                whileTap={{ scale: 0.9 }}
                transition={spring.pop}
                aria-label={`Portrait ${id}`}
              >
                <img src={photoUrl(id, 120)} alt="" loading="lazy" />
              </motion.button>
            );
          })}
        </div>
      )}

      {tab === 'characters' && (
        <>
          <div className="avatar-picker__grid">
            {characters.map(({ style, url }) => (
              <motion.button
                key={style + url}
                type="button"
                className="avatar-picker__item avatar-picker__item--pad"
                data-selected={value === url}
                onClick={() => {
                  haptic('light');
                  onChange(url);
                }}
                whileTap={{ scale: 0.9 }}
                transition={spring.pop}
                aria-label={`${style} character`}
              >
                <img src={url} alt="" loading="lazy" />
              </motion.button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm avatar-picker__shuffle"
            onClick={() => {
              haptic('light');
              setSeedNudge((n) => n + 1);
            }}
          >
            ↻ Shuffle characters
          </button>
        </>
      )}

      {tab === 'upload' && (
        <div className="avatar-picker__upload">
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Choose a photo'}
          </button>
          <p className="t-xs faint">Square looks best. It's resized on your device before upload.</p>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pickFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
