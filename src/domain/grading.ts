/**
 * S2 — grading.
 *
 * The riskiest code in the app: a bug here corrupts a user's progress silently
 * and cumulatively. It therefore takes plain numbers and returns plain numbers,
 * so every outcome at every level is testable with no database and no mocks.
 *
 * framework.md: the grade is decided at FIRST SIGHT of a card. Re-query
 * appearances are ungraded — see `resolveRequeue`.
 */

import {
  MASTERED_LEVEL,
  MIN_STUDIED_LEVEL,
  NEW_LEVEL,
  clampLevel,
  dueDayFor,
  type DayNumber,
  type Level,
} from './ladder';

/** What the user did on first sight of a card. */
export type Outcome =
  /** Typed or selected the right answer. */
  | 'correct'
  /** Got it wrong but pressed *Mark correct* — a typo, or a synonym we missed. */
  | 'markCorrect'
  /** Got it wrong and pressed *Redo question* — "close enough, don't count it". */
  | 'redo'
  /** Got it wrong and pressed nothing. The default, and the punishing path. */
  | 'none';

export interface CardState {
  level: Level;
  dueDay: DayNumber;
}

export interface GradeResult extends CardState {
  /** Whether the card re-enters the session queue for ungraded practice. */
  requeue: boolean;
}

/**
 * Grade a card at first sight.
 *
 * Pressing nothing demotes: the default is deliberately the punishing path, and
 * *Redo question* is an active mercy the user extends to themselves.
 */
export function grade(
  state: CardState,
  outcome: Outcome,
  today: DayNumber,
): GradeResult {
  const level = clampLevel(state.level);

  switch (outcome) {
    case 'correct':
    case 'markCorrect': {
      const next = Math.min(MASTERED_LEVEL, level + 1);
      return { level: next, dueDay: dueDayFor(next, today), requeue: false };
    }

    case 'redo': {
      // Level AND due day both untouched, so the card is still due today and
      // returns in the next session too — not just later in this one. A deck
      // cannot reach "Caught up" while any redone word is outstanding.
      return { level, dueDay: state.dueDay, requeue: true };
    }

    case 'none': {
      const next = demote(level);
      return { level: next, dueDay: dueDayFor(next, today), requeue: true };
    }
  }
}

/**
 * A wrong answer's level movement.
 *
 * The floor of 1 was written for demotions from higher levels. Applied to a new
 * word it would *promote* one the user has just failed, so level 0 holds at 0 —
 * nothing is earned until something is answered right. Since level 0's interval
 * is zero days, such a card simply stays due today.
 */
function demote(level: Level): Level {
  if (level <= NEW_LEVEL) return NEW_LEVEL;
  return Math.max(MIN_STUDIED_LEVEL, level - 1);
}

/** What the user did on a re-query appearance. */
export type RequeueOutcome = 'correct' | 'markCorrect' | 'wrong';

export interface RequeueResult {
  /** True when the card leaves the queue. False means it re-queues again. */
  clears: boolean;
}

/**
 * Resolve a re-query appearance.
 *
 * The level NEVER moves here, however often a card recurs — otherwise a
 * demotion could always be undone and no demotion would ever stick. A card
 * leaves the queue only by being answered correctly, or by *Mark correct*,
 * which counts it done without grading it. That second path is the exit for a
 * word the user genuinely cannot produce; without it the session could not be
 * finished.
 */
export function resolveRequeue(outcome: RequeueOutcome): RequeueResult {
  return { clears: outcome === 'correct' || outcome === 'markCorrect' };
}

/** Whether an outcome counts as a promotion, for the session summary. */
export function isPromotion(outcome: Outcome): boolean {
  return outcome === 'correct' || outcome === 'markCorrect';
}

export function isDemotion(outcome: Outcome, level: Level): boolean {
  return outcome === 'none' && level > NEW_LEVEL;
}
