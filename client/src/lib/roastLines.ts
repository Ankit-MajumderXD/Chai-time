/**
 * Metadata for roast reactions.
 *
 * `Heat` (mild/spicy/savage) drives how *intense* the send animation runs.
 * `RoastStyle` (fire/devil/skull/clown) picks *which* animation and emoji badge.
 * The lines themselves come from the seeded `roast_line_library` table.
 */

export type Heat = 'mild' | 'spicy' | 'savage';

export type RoastStyle = 'fire' | 'devil' | 'skull' | 'clown';

export interface RoastStyleMeta {
  key: RoastStyle;
  label: string;
  emoji: string;
  /** Accent colour for the chip / badge / particles. */
  hue: string;
}

export const ROAST_STYLES: Record<RoastStyle, RoastStyleMeta> = {
  fire: { key: 'fire', label: 'Fire', emoji: '🔥', hue: '#ff5a2c' },
  devil: { key: 'devil', label: 'Devil', emoji: '😈', hue: '#d64550' },
  skull: { key: 'skull', label: 'Skull', emoji: '💀', hue: '#7b7b88' },
  clown: { key: 'clown', label: 'Clown', emoji: '🤡', hue: '#ff7ac0' },
};

export const ROAST_STYLE_ORDER: RoastStyle[] = ['fire', 'devil', 'skull', 'clown'];

export function roastStyleMeta(s: string): RoastStyleMeta {
  return ROAST_STYLES[(s as RoastStyle) in ROAST_STYLES ? (s as RoastStyle) : 'fire'];
}

export interface HeatMeta {
  key: Heat;
  label: string;
  flames: string;
  hue: string;
  /** Particle count for the ember/flame trail on send. */
  embers: number;
}

export const HEATS: Record<Heat, HeatMeta> = {
  mild: { key: 'mild', label: 'Mild', flames: '🔥', hue: '#ff9d3d', embers: 6 },
  spicy: { key: 'spicy', label: 'Spicy', flames: '🔥🔥', hue: '#ff5a2c', embers: 12 },
  savage: { key: 'savage', label: 'Savage', flames: '🔥🔥🔥', hue: '#ff2d55', embers: 22 },
};

export const HEAT_ORDER: Heat[] = ['mild', 'spicy', 'savage'];

export function heatMeta(h: string): HeatMeta {
  return HEATS[(h as Heat) in HEATS ? (h as Heat) : 'mild'];
}

/** Rank for sorting a moment's roast reactions hottest-first. */
export function heatRank(h: string): number {
  return HEAT_ORDER.indexOf(h as Heat);
}
