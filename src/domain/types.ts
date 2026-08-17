/**
 * Shared value types for the domain. Data shapes only — no behaviour, and no
 * knowledge of storage or screens.
 */

import type { DayNumber, Level } from './ladder';
import type { VectorId } from './vectors';

/** `es:banco:noun:2` — language, normalized term, part of speech, sense ordinal. */
export type WordKey = string;

/** packs.framework.md: four tiers, deliberately approximate. */
export type DifficultyTier = 'basic' | 'common' | 'advanced' | 'niche';

export const DIFFICULTY_TIERS: readonly DifficultyTier[] = Object.freeze([
  'basic',
  'common',
  'advanced',
  'niche',
]);

/**
 * Sampling weights for new-word selection. Common words dominate without the
 * deck feeling like reading a dictionary front to back.
 */
export const TIER_WEIGHT: Readonly<Record<DifficultyTier, number>> =
  Object.freeze({ basic: 4, common: 3, advanced: 2, niche: 1 });

/** The stored progress for one (word, vector) pair. Two integers, nothing else. */
export interface VectorProgress {
  level: Level;
  dueDay: DayNumber;
}

/** Everything known about one word's study state. */
export interface WordProgress {
  key: WordKey;
  /** Absent until the word is first quizzed. Also the new-word budget counter. */
  introducedOn?: DayNumber;
  hidden?: boolean;
  vectors: Readonly<Partial<Record<VectorId, VectorProgress>>>;
}

/** A word as the session needs to see it. The dictionary supplies these. */
export interface DeckMember {
  key: WordKey;
  difficulty: DifficultyTier;
}

/** One question to ask. */
export interface Card {
  wordKey: WordKey;
  vectorId: VectorId;
  /** True when this word has never been quizzed before. */
  isNew: boolean;
}

/** A source of randomness, injectable so tests are deterministic. */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;
