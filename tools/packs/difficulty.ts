/**
 * S4 — difficulty banding.
 *
 * packs.framework.md: frequency rank splits Basic / Common / Advanced, and a
 * register or domain label promotes a sense to Niche. The cutoffs are
 * deliberately approximate and expect tuning against real data, so they live
 * here as named constants rather than scattered through the pipeline.
 *
 * `niche` may come out legitimately empty in a frequency-selected pack — rare
 * words are excluded by the selection itself. The scale exists before the words
 * do, and fills as packs extend past the core.
 */

import type { DifficultyTier } from '../../src/domain/types';
import type { SenseCandidate } from './kaikki';
import { normalizeTerm } from './registry';

/** Rank boundaries, by folded lemma rank. Above `advanced` is still advanced. */
export const TIER_CUTOFFS = Object.freeze({
  basic: 1000,
  common: 3000,
  advanced: 6000,
});

/**
 * Labels that mark a sense as specialist regardless of how common its spelling
 * is. `banco` is a Basic word, but its banking-jargon sense is not Basic
 * vocabulary, and frequency cannot see the difference because both senses share
 * one spelling.
 */
export const NICHE_LABELS: readonly string[] = Object.freeze([
  'archaic',
  'rare',
  'obsolete',
  'dialectal',
  'poetic',
  'literary',
  'slang',
  'vulgar',
  'humorous',
  'dated',
  'historical',
]);

export function hasNicheLabel(sense: SenseCandidate): boolean {
  return sense.tags.some((t) => NICHE_LABELS.includes(t));
}

/**
 * Band one sense.
 *
 * An unranked word — absent from the frequency list entirely — lands in
 * `advanced` rather than `niche`: absence from a subtitle corpus says the word
 * is uncommon in speech, not that it is archaic or specialist.
 */
export function tierFor(
  sense: SenseCandidate,
  ranks: ReadonlyMap<string, number>,
): DifficultyTier {
  if (hasNicheLabel(sense)) return 'niche';

  const rank = ranks.get(normalizeTerm(sense.term));
  if (rank === undefined) return 'advanced';
  if (rank <= TIER_CUTOFFS.basic) return 'basic';
  if (rank <= TIER_CUTOFFS.common) return 'common';
  return 'advanced';
}
