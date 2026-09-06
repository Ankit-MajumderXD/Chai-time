/**
 * Haptics. Silently absent on desktop and on iOS Safari, which is fine — the
 * visual press feedback carries the interaction on its own.
 */
type Weight = 'light' | 'medium' | 'heavy' | 'success';

const PATTERNS: Record<Weight, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 22,
  success: [10, 40, 16],
};

export function haptic(weight: Weight = 'light') {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[weight]);
  } catch {
    /* device said no; nothing to recover from */
  }
}
