/**
 * S7 — deck state.
 *
 * framework.md: four states, and `Complete` must never be rendered as `Empty`.
 * `Complete` is the win condition — the user finished what they set out to
 * learn — while `Empty` is a deck that was never populated. Rendering the first
 * as the second turns an accomplishment into an error message, and the lazy
 * implementation of both is the same null check, which is exactly why they are
 * separate values here rather than a count of zero.
 */

import { isDue, isMastered, NEW_LEVEL, type DayNumber } from './ladder';
import type { WordKey, WordProgress } from './types';
import type { VectorId } from './vectors';

export type DeckStatus = 'due' | 'caughtUp' | 'complete' | 'empty';

export interface DeckStateInput {
  memberKeys: readonly WordKey[];
  progress: ReadonlyMap<WordKey, WordProgress>;
  enabledVectors: readonly VectorId[];
  requeryMastered: boolean;
  today: DayNumber;
}

export interface DeckState {
  status: DeckStatus;
  /** Cards available right now — reviews due plus words never introduced. */
  dueCount: number;
  /** Members never quizzed. */
  newCount: number;
  /** Reviews already past their day. Surfaces the backlog so the user can act. */
  overdueCount: number;
  /** Absent when nothing is scheduled at all — the `complete` case. */
  nextDueDay?: DayNumber;
  distribution: LadderDistribution;
}

/** Bucketed for the deck bar. Counts words, not vectors. */
export interface LadderDistribution {
  new: number;
  learning: number;
  mature: number;
  mastered: number;
}

export function computeDeckState(input: DeckStateInput): DeckState {
  const { memberKeys, progress, enabledVectors, requeryMastered, today } = input;

  const visible = memberKeys.filter((key) => !progress.get(key)?.hidden);

  if (visible.length === 0) {
    return {
      status: 'empty',
      dueCount: 0,
      newCount: 0,
      overdueCount: 0,
      distribution: { new: 0, learning: 0, mature: 0, mastered: 0 },
    };
  }

  const distribution: LadderDistribution = { new: 0, learning: 0, mature: 0, mastered: 0 };
  let dueCount = 0;
  let newCount = 0;
  let overdueCount = 0;
  let nextDueDay: DayNumber | undefined;
  let anyServable = false;

  for (const key of visible) {
    const word = progress.get(key);

    if (!word || word.introducedOn === undefined) {
      newCount += 1;
      dueCount += 1;
      distribution.new += 1;
      anyServable = true;
      continue;
    }

    let wordDue = false;
    let wordServable = false;
    let highest = NEW_LEVEL;

    for (const vectorId of enabledVectors) {
      const state = word.vectors[vectorId];
      // Same rule as session composition: an un-quizzed vector of an introduced
      // word became due when the word was introduced.
      const level = state?.level ?? NEW_LEVEL;
      const dueDay = state?.dueDay ?? word.introducedOn ?? today;

      highest = Math.max(highest, level);

      if (isMastered(level) && !requeryMastered) continue;
      wordServable = true;

      if (isDue(dueDay, today)) {
        wordDue = true;
        if (dueDay < today) overdueCount += 1;
      } else if (nextDueDay === undefined || dueDay < nextDueDay) {
        nextDueDay = dueDay;
      }
    }

    if (wordServable) anyServable = true;
    if (wordDue) dueCount += 1;

    bucket(distribution, highest);
  }

  if (dueCount > 0) {
    return { status: 'due', dueCount, newCount, overdueCount, nextDueDay, distribution };
  }

  // Nothing due AND nothing scheduled — every word mastered with re-query off.
  // Reachable only because mastered words leave the rotation; under a plain
  // level-9 cap every word would always carry a next due day.
  if (!anyServable || nextDueDay === undefined) {
    return { status: 'complete', dueCount: 0, newCount, overdueCount, distribution };
  }

  return { status: 'caughtUp', dueCount: 0, newCount, overdueCount, nextDueDay, distribution };
}

function bucket(dist: LadderDistribution, level: number): void {
  if (isMastered(level)) dist.mastered += 1;
  else if (level >= 5) dist.mature += 1;
  else if (level >= 1) dist.learning += 1;
  else dist.new += 1;
}
