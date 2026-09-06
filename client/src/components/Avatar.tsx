/**
 * Avatar, presence dot and avatar stack.
 *
 * A photo is the happy path; when it fails (offline, slow, no picture yet) the
 * fallback is a warm pastel monogram, never a grey silhouette.
 */
import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { hashIndex, initials } from '../lib/format';
import { spring } from '../design/motion';

export type Presence = 'online' | 'away' | 'offline';

const PASTELS = [
  'linear-gradient(140deg,#ffd9c0,#ffc0cb)',
  'linear-gradient(140deg,#cfe3ff,#ddd6ff)',
  'linear-gradient(140deg,#ffe9ae,#ffc9a3)',
  'linear-gradient(140deg,#d5f3e2,#c5e8f5)',
  'linear-gradient(140deg,#e6dcff,#ffd9ea)',
  'linear-gradient(140deg,#f2e8dc,#e4e0f5)',
];

interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  presence?: Presence | null;
  /** Small emoji bubble for what they're doing right now. */
  badge?: string;
  ring?: boolean;
  className?: string;
}

export const Avatar = memo(function Avatar({
  name,
  src,
  size = 48,
  presence = null,
  badge,
  ring = false,
  className,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!src && !failed;
  // Clamped, not linear: a big avatar wants a proportionally smaller dot.
  const dotSize = Math.round(Math.min(15, Math.max(9, size * 0.24)));

  return (
    <div
      className={`avatar${ring ? ' avatar--ring' : ''}${className ? ' ' + className : ''}`}
      style={{ width: size, height: size }}
    >
      <div
        className="avatar__inner"
        style={{ background: PASTELS[hashIndex(name, PASTELS.length)] }}
      >
        {showPhoto ? (
          <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <span
            className="avatar__initials"
            style={{ fontSize: Math.max(11, Math.round(size * 0.36)) }}
          >
            {initials(name)}
          </span>
        )}
      </div>

      {presence && (
        <PresenceDot presence={presence} size={dotSize} className="avatar__dot" />
      )}

      {badge && (
        <motion.span
          key={badge}
          className="avatar__badge"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring.pop}
          style={{ fontSize: Math.max(10, Math.round(size * 0.3)) }}
        >
          {badge}
        </motion.span>
      )}
    </div>
  );
});

export function PresenceDot({
  presence,
  size = 10,
  className,
}: {
  presence: Presence;
  size?: number;
  className?: string;
}) {
  return (
    <motion.span
      className={`presence${className ? ' ' + className : ''}`}
      data-presence={presence}
      style={{ width: size, height: size }}
      /* The colour crossfades instead of snapping when someone comes online. */
      animate={{ scale: presence === 'online' ? 1 : 0.88 }}
      transition={spring.snappy}
    >
      {presence === 'online' && <span className="presence__halo" />}
    </motion.span>
  );
}

interface StackProps {
  people: Array<{ id: string; name: string; avatarUrl?: string }>;
  size?: number;
  max?: number;
  overflow?: number;
}

export function AvatarStack({ people, size = 30, max = 4, overflow }: StackProps) {
  const shown = people.slice(0, max);
  const extra = overflow ?? Math.max(0, people.length - shown.length);

  return (
    <div className="avatar-stack" style={{ ['--stack-size' as string]: `${size}px` }}>
      {shown.map((person) => (
        <Avatar key={person.id} name={person.name} src={person.avatarUrl} size={size} />
      ))}
      {extra > 0 && (
        <span className="avatar-stack__more" style={{ width: size, height: size }}>
          +{extra}
        </span>
      )}
    </div>
  );
}
