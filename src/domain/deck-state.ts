/**
 * S7 — deck state.
 *
 * framework.md: four states, and `Complete` must never be rendered as `Empty`.
 * `Complete` is the win condition — the user finished what they set out to
 * learn — while `Empty` is a deck that was never populated. Rendering the first
 * as the second turns an accomplishment into an error message, and the lazy
 * implementation of both is the same null check, which is exactly why they are
 * separate values here rather than a count of zero.
 *
 * The due count reported here is what a session would ACTUALLY serve, budget
 * and cap included. Counting raw availability instead made the deck advertise
 * seven words, serve five, and — once the day's new-word budget was spent —
 * offer a session that turned out to be empty.
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
  /** Ceiling on one session. */
  cardCap: number;
  /** How many previously unseen words may enter today. */
  newWordsPerDay: number;
}

export interface DeckState {
  status: DeckStatus;
  /** Cards a session would serve right now. Never more than the cap. */
  dueCount: number;
  /** Members never quizzed — including those beyond today's budget. */
  newCount: number;
  /** New words today's budget still allows. */
  newAllowedToday: number;
  /** Reviews already past their day. Surfaces the backlog so it can be acted on. */
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
      newAllowedToday: 0,
      overdueCount: 0,
      distribution: { new: 0, learning: 0, mature: 0, mastered: 0 },
    };
  }

  const distribution: LadderDistribution = { new: 0, learning: 0, mature: 0, mastered: 0 };
  let unlearned = 0;
  let reviewsDue = 0;
  let introducedToday = 0;
  let overdueCount = 0;
  let nextDueDay: DayNumber | undefined;
  let anyServable = false;

  for (const key of visible) {
    const word = progress.get(key);

    if (!word || word.introducedOn === undefined) {
      unlearned += 1;
      distribution.new += 1;
      anyServable = true;
      continue;
    }

    if (word.introducedOn === today) introducedToday += 1;

    let wordDue = false;
    let highest = NEW_LEVEL;

    for (const vectorId of enabledVectors) {
      const state = word.vectors[vectorId];
      // Same rule as session composition: an un-quizzed vector of an introduced
      // word became due when the word was introduced.
      const level = state?.level ?? NEW_LEVEL;
      const dueDay = state?.dueDay ?? word.introducedOn ?? today;

      highest = Math.max(highest, level);

      if (isMastered(level) && !requeryMastered) continue;
      anyServable = true;

      if (isDue(dueDay, today)) {
        wordDue = true;
        if (dueDay < today) overdueCount += 1;
      } else if (nextDueDay === undefined || dueDay < nextDueDay) {
        nextDueDay = dueDay;
      }
    }

    if (wordDue) reviewsDue += 1;
    bucket(distribution, highest);
  }

  const newAllowedToday = Math.max(0, input.newWordsPerDay - introducedToday);
  const newInSession = Math.min(unlearned, newAllowedToday);
  const dueCount = Math.min(input.cardCap, newInSession + reviewsDue);

  if (dueCount > 0) {
    return {
      status: 'due',
      dueCount,
      newCount: unlearned,
      newAllowedToday,
      overdueCount,
      nextDueDay,
      distribution,
    };
  }

  // Unlearned words remain but today's budget is spent: the deck is caught up
  // FOR TODAY and opens again tomorrow. Saying "complete" here would be a lie.
  if (unlearned > 0 && newAllowedToday === 0) {
    return {
      status: 'caughtUp',
      dueCount: 0,
      newCount: unlearned,
      newAllowedToday,
      overdueCount,
      nextDueDay: nextDueDay !== undefined ? Math.min(nextDueDay, today + 1) : today + 1,
      distribution,
    };
  }

  // Nothing due AND nothing scheduled — every word mastered with re-query off.
  // Reachable only because mastered words leave the rotation; under a plain
  // level-9 cap every word would always carry a next due day.
  if (!anyServable || nextDueDay === undefined) {
    return {
      status: 'complete',
      dueCount: 0,
      newCount: unlearned,
      newAllowedToday,
      overdueCount,
      distribution,
    };
  }

  return {
    status: 'caughtUp',
    dueCount: 0,
    newCount: unlearned,
    newAllowedToday,
    overdueCount,
    nextDueDay,
    distribution,
  };
}

function bucket(dist: LadderDistribution, level: number): void {
  if (isMastered(level)) dist.mastered += 1;
  else if (level >= 5) dist.mature += 1;
  else if (level >= 1) dist.learning += 1;
  else dist.new += 1;
}
