/**
 * S1 — the mastery ladder and due-day arithmetic.
 *
 * framework.md: level 0 is new and due immediately; levels 1–9 carry a fixed
 * rest interval. There is no ease factor and no adaptive component — the ladder
 * IS the algorithm. All arithmetic is on whole days; nothing here accepts or
 * returns a time of day.
 */

/** Rest interval in whole days, indexed by level. Index 0 is unused (new). */
export const LADDER: readonly number[] = Object.freeze([
  0, 1, 2, 4, 7, 14, 21, 30, 60, 100,
]);

export const NEW_LEVEL = 0;
export const MIN_STUDIED_LEVEL = 1;
export const MASTERED_LEVEL = 9;

export type Level = number;

/** A whole-day integer. Days since the Unix epoch, in the user's local calendar. */
export type DayNumber = number;

const MS_PER_DAY = 86_400_000;

/**
 * Local calendar day as an integer. Uses the local Y/M/D so the day boundary is
 * the user's midnight, not UTC's — a session at 23:30 belongs to that day.
 */
export function toDayNumber(date: Date = new Date()): DayNumber {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY,
  );
}

export function fromDayNumber(day: DayNumber): Date {
  const ms = day * MS_PER_DAY;
  const utc = new Date(ms);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

export function isValidLevel(level: number): boolean {
  return Number.isInteger(level) && level >= NEW_LEVEL && level <= MASTERED_LEVEL;
}

export function clampLevel(level: number): Level {
  if (!Number.isFinite(level)) return NEW_LEVEL;
  return Math.min(MASTERED_LEVEL, Math.max(NEW_LEVEL, Math.round(level)));
}

export function isMastered(level: Level): boolean {
  return level >= MASTERED_LEVEL;
}

/** Rest interval for a level. Level 0 rests zero days — it is due immediately. */
export function intervalForLevel(level: Level): number {
  return LADDER[clampLevel(level)] ?? 0;
}

/** The day a card at `level` graded on `today` should next come up. */
export function dueDayFor(level: Level, today: DayNumber): DayNumber {
  return today + intervalForLevel(level);
}

/**
 * When a card was last studied, derived rather than stored.
 * architecture.md: storing `dueDay` and deriving this is what lets the database
 * range-query due cards directly, and what stops a ladder edit from silently
 * rescheduling every card already in flight.
 */
export function lastStudiedFrom(level: Level, dueDay: DayNumber): DayNumber {
  return dueDay - intervalForLevel(level);
}

/** Positive when the card is late. The review sort key. */
export function overdueBy(dueDay: DayNumber, today: DayNumber): number {
  return today - dueDay;
}

export function isDue(dueDay: DayNumber, today: DayNumber): boolean {
  return dueDay <= today;
}
