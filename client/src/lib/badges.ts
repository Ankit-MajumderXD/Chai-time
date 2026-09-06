/**
 * Badge metadata — the display side of the `badge` table's `badgeType` string.
 *
 * The server mints rows; this file decides what each one looks and reads like.
 */

export type BadgeType = '7_day_streak' | '30_day_streak' | 'roast_champion' | 'most_reactions';

export interface BadgeMeta {
  type: BadgeType;
  emoji: string;
  label: string;
  blurb: string;
  /** Drives the ring / glow colour on the badge chip and unlock burst. */
  hue: string;
}

export const BADGES: Record<BadgeType, BadgeMeta> = {
  '7_day_streak': {
    type: '7_day_streak',
    emoji: '🔥',
    label: 'Week on fire',
    blurb: 'Posted a moment seven days running.',
    hue: '#ff8a3d',
  },
  '30_day_streak': {
    type: '30_day_streak',
    emoji: '⚡',
    label: 'Unbroken',
    blurb: 'Thirty days without missing a beat.',
    hue: '#6ea8ff',
  },
  roast_champion: {
    type: 'roast_champion',
    emoji: '👑',
    label: 'Roast champion',
    blurb: 'Landed the top-voted roast of the day.',
    hue: '#ffcf3d',
  },
  most_reactions: {
    type: 'most_reactions',
    emoji: '💥',
    label: 'Main character',
    blurb: 'Your moments pulled the most reactions today.',
    hue: '#ff5db1',
  },
};

export const BADGE_ORDER: BadgeType[] = [
  '7_day_streak',
  '30_day_streak',
  'roast_champion',
  'most_reactions',
];

export function badgeMeta(type: string): BadgeMeta | undefined {
  return (BADGES as Record<string, BadgeMeta>)[type];
}
