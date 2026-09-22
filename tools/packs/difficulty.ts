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
 * How often corpus sentences were routed to a sense, against its whole term.
 * Counts come from `routeSentences`, before any example limit is applied.
 */
export interface SenseEvidence {
  /** Sentences this sense won. */
  sense: number;
  /** Sentences any sense of the term won. */
  term: number;
  /** How many senses the term has, across parts of speech. */
  senses: number;
}

/**
 * Below this, a term's sentences are too few to say anything about which of its
 * senses are in use. The Vietnamese corpus is 32k sentences; plenty of real,
 * common senses simply never come up in it.
 */
export const MIN_TERM_EVIDENCE = 3;

/**
 * A sense holding less than this share of its term's matched sentences is
 * treated as unattested. Zero alone was too strict: `lại` "to recover" matched
 * two sentences out of well over a hundred and stayed Basic.
 */
export const RARE_SHARE = 0.05;

/**
 * A sense the corpus (almost) never uses although it uses its siblings.
 *
 * A frequency list counts SPELLINGS, so every sense of a common word inherited
 * its rank: all six senses of `lại` were Basic, including "to recover" and "to
 * make up for one's disadvantage", and `súng` "water lily" was as Basic as
 * `súng` "gun". Sentences routed by meaning are the only sense-level usage
 * signal the sources offer.
 */
export function isUnattested(evidence: SenseEvidence): boolean {
  return (
    evidence.senses > 1 &&
    evidence.term >= MIN_TERM_EVIDENCE &&
    evidence.sense < evidence.term * RARE_SHARE
  );
}

/**
 * Parts of speech whose glosses DESCRIBE rather than translate — `đi` the
 * particle is "at the end of a sentence, conveys a command", which no
 * translation will ever contain. Routing cannot attest them, so the absence of
 * evidence says nothing and they are never banded down for it.
 */
const DESCRIBED_POS = new Set([
  'particle',
  'pron',
  'prep',
  'postp',
  'conj',
  'det',
  'article',
  'intj',
  'classifier',
  'num',
  'affix',
  'prefix',
  'suffix',
  'combining_form',
]);

/** Whether `tierFor` bands this sense one harder for lack of usage evidence. */
export function isDemotedForEvidence(sense: SenseCandidate, evidence: SenseEvidence): boolean {
  return !DESCRIBED_POS.has(sense.partOfSpeech) && isUnattested(evidence);
}

/** One band harder. `advanced` stays put: `niche` means specialist, not rare. */
function demote(tier: DifficultyTier): DifficultyTier {
  if (tier === 'basic') return 'common';
  if (tier === 'common') return 'advanced';
  return tier;
}

/**
 * Band one sense.
 *
 * An unranked word — absent from the frequency list entirely — lands in
 * `advanced` rather than `niche`: absence from a subtitle corpus says the word
 * is uncommon in speech, not that it is archaic or specialist.
 *
 * With `evidence`, an unattested sense of a polysemous term drops one band, so
 * a Basic deck serves the senses people actually use. Difficulty is not part
 * of the key, so this moves no progress.
 */
export function tierFor(
  sense: SenseCandidate,
  ranks: ReadonlyMap<string, number>,
  evidence?: SenseEvidence,
): DifficultyTier {
  if (hasNicheLabel(sense)) return 'niche';

  const rank = ranks.get(normalizeTerm(sense.term));
  const tier: DifficultyTier =
    rank === undefined
      ? 'advanced'
      : rank <= TIER_CUTOFFS.basic
        ? 'basic'
        : rank <= TIER_CUTOFFS.common
          ? 'common'
          : 'advanced';

  return evidence && isDemotedForEvidence(sense, evidence) ? demote(tier) : tier;
}
