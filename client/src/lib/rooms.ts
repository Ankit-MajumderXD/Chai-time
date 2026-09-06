/**
 * Room moods and imagery.
 *
 * A room's `kind` changes its accent, gradient, cover and emoji — never its
 * layout. One design system, six personalities.
 */

export type RoomKind = 'family' | 'friends' | 'trip' | 'event' | 'college' | 'other';

export interface RoomMood {
  kind: RoomKind;
  label: string;
  emoji: string;
  blurb: string;
  /** Seed for the cover photo, so a room's picture is stable across devices. */
  coverSeed: string;
}

export const ROOM_MOODS: RoomMood[] = [
  {
    kind: 'friends',
    label: 'Friends',
    emoji: '✨',
    blurb: 'The group chat, but alive',
    coverSeed: 'chai-friends',
  },
  {
    kind: 'family',
    label: 'Family',
    emoji: '❤️',
    blurb: 'Home, wherever everyone is',
    coverSeed: 'chai-family',
  },
  {
    kind: 'trip',
    label: 'Trip',
    emoji: '🏝️',
    blurb: 'For the ones on the road',
    coverSeed: 'chai-goa',
  },
  {
    kind: 'event',
    label: 'Event',
    emoji: '🎉',
    blurb: 'Temporary, loud, unforgettable',
    coverSeed: 'chai-event',
  },
  {
    kind: 'college',
    label: 'College',
    emoji: '🎓',
    blurb: 'Between classes and chai',
    coverSeed: 'chai-college',
  },
  {
    kind: 'other',
    label: 'Something else',
    emoji: '🪄',
    blurb: 'Make it your own',
    coverSeed: 'chai-other',
  },
];

export function moodFor(kind: string): RoomMood {
  return ROOM_MOODS.find((m) => m.kind === kind) ?? ROOM_MOODS[5];
}

/** Real photography, deterministic per seed, no API key, always resolves. */
export function photoUrl(seed: string, w = 900, h = 1200): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

export function coverFor(kind: string, code: string): string {
  return photoUrl(`${moodFor(kind).coverSeed}-${code}`, 800, 600);
}

/** What you can tell your people you're doing. */
export interface ActivityPreset {
  emoji: string;
  label: string;
}

export const ACTIVITY_PRESETS: ActivityPreset[] = [
  { emoji: '🟢', label: 'Around' },
  { emoji: '🍳', label: 'Cooking' },
  { emoji: '🍛', label: 'Eating' },
  { emoji: '🎧', label: 'Music' },
  { emoji: '🏫', label: 'College' },
  { emoji: '💻', label: 'Working' },
  { emoji: '🎮', label: 'Gaming' },
  { emoji: '🚗', label: 'Driving' },
  { emoji: '✈️', label: 'Traveling' },
  { emoji: '🏋️', label: 'Gym' },
  { emoji: '📖', label: 'Studying' },
  { emoji: '😴', label: 'Sleeping' },
  { emoji: '🏠', label: 'At home' },
  { emoji: '☕', label: 'Chai break' },
];

export const QUICK_REACTIONS = ['❤️', '😂', '😍', '🔥', '👏', '😭', '😮'] as const;

/** Onboarding photo collage — realistic snapshots, stable across reloads. */
export const ONBOARDING_PHOTOS = [
  { seed: 'chai-onb-friends', tilt: -7, label: 'Sunday' },
  { seed: 'chai-onb-food', tilt: 5, label: 'dinner ✨' },
  { seed: 'chai-onb-travel', tilt: -3, label: 'the trip' },
];
