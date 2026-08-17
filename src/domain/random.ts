/**
 * Shared randomness helpers. Every one takes an injectable `Rng` so tests are
 * deterministic — nothing in `domain` reaches for `Math.random` directly.
 */

import { defaultRng, type Rng } from './types';

/** Fisher–Yates. Returns a new array; the input is untouched. */
export function shuffle<T>(items: readonly T[], rng: Rng = defaultRng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

export function randomOf<T>(items: readonly T[], rng: Rng = defaultRng): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rng() * items.length)];
}
