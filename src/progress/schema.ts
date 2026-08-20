/**
 * S8 (progress half) — the stores this module owns.
 *
 * User data: small, mutable, irreplaceable. This is the transferable part of
 * the app — moving a user to another machine means moving what this module
 * owns and nothing else (architecture.md D1).
 */

import type { DayNumber, Level } from '../domain/ladder';
import type { DifficultyTier, WordKey } from '../domain/types';
import type { VectorId } from '../domain/vectors';

/** Two integers per (word, vector). The entire scheduling state. */
export interface ProgressRow {
  wordKey: WordKey;
  vectorId: VectorId;
  level: Level;
  dueDay: DayNumber;
}

/** Word-level facts that are not per-vector. */
export interface WordRow {
  key: WordKey;
  /**
   * The day the word was first QUIZZED — not when it was shown on the new
   * vocabulary screen, so abandoning that screen leaves it un-introduced.
   * Doubles as the new-word budget counter, and as the due day an un-quizzed
   * vector inherits.
   */
  introducedOn?: DayNumber;
  hidden?: boolean;
}

/**
 * The recipe that produced a deck, kept so a pack update can be diffed.
 *
 * Within a group the terms are OR'd; between groups they are AND'd. So
 * `{ difficulties: ['advanced'], contextTags: ['finance'] }` is "advanced
 * finance words", while `{ difficulties: ['basic', 'common'] }` is "basic or
 * common".
 *
 * An EMPTY group means no constraint from that axis — which is what makes
 * "everything in the pack" just both groups empty, rather than a special case.
 */
export interface DeckRecipe {
  difficulties: DifficultyTier[];
  contextTags: string[];
  /** Sequence-tagged words are excluded by default — numbers are learned in order. */
  includeSequence: boolean;
}

/** The shape stored before recipes gained multi-select. Read by the migration. */
export interface LegacyDeckRecipe {
  kind: 'all' | 'difficulty' | 'contextTag';
  value?: string;
  includeSequence: boolean;
}

export interface DeckRow {
  id: string;
  language: string;
  name: string;
  tags: string[];
  memberKeys: WordKey[];
  recipe: DeckRecipe;
  createdOn: DayNumber;
  /** Per-deck settings. Defaults applied on read when absent. */
  cardCap?: number;
  newWordsPerDay?: number;
  enabledVectors?: VectorId[];
  requeryMastered?: boolean;
}

/** Simple key/value bag for global settings. */
export interface SettingRow {
  key: string;
  value: unknown;
}

export const PROGRESS_STORES = {
  progress: '[wordKey+vectorId], wordKey, vectorId, dueDay',
  words: 'key, introducedOn',
  decks: 'id, language',
  settings: 'key',
} as const;

/** Re-exported so callers of this module do not reach into `domain` for them. */
export type { DifficultyTier, WordKey, VectorId, DayNumber, Level };
