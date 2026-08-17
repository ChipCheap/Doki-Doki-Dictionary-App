import { describe, expect, it } from 'vitest';
import {
  LADDER,
  MASTERED_LEVEL,
  clampLevel,
  dueDayFor,
  fromDayNumber,
  intervalForLevel,
  isDue,
  isMastered,
  lastStudiedFrom,
  overdueBy,
  toDayNumber,
} from './ladder';

describe('the ladder', () => {
  it('carries the intervals the framework specifies', () => {
    expect(LADDER.slice(1)).toEqual([1, 2, 4, 7, 14, 21, 30, 60, 100]);
  });

  it('rests a new word zero days — it is due immediately', () => {
    expect(intervalForLevel(0)).toBe(0);
  });

  it('tops out at 100 days', () => {
    expect(intervalForLevel(MASTERED_LEVEL)).toBe(100);
  });

  it('clamps anything outside 0–9 rather than producing a gap', () => {
    expect(clampLevel(-4)).toBe(0);
    expect(clampLevel(99)).toBe(MASTERED_LEVEL);
    expect(clampLevel(Number.NaN)).toBe(0);
  });

  it('treats only level 9 as mastered', () => {
    expect(isMastered(8)).toBe(false);
    expect(isMastered(9)).toBe(true);
  });
});

describe('day arithmetic', () => {
  it('uses the local calendar day, so a late-evening session counts as today', () => {
    const lateEvening = new Date(2026, 7, 16, 23, 30);
    const sameMorning = new Date(2026, 7, 16, 7, 0);
    expect(toDayNumber(lateEvening)).toBe(toDayNumber(sameMorning));
  });

  it('advances by one across midnight', () => {
    const before = new Date(2026, 7, 16, 23, 59);
    const after = new Date(2026, 7, 17, 0, 1);
    expect(toDayNumber(after) - toDayNumber(before)).toBe(1);
  });

  it('round-trips a day number back to its date', () => {
    const date = new Date(2026, 7, 16);
    expect(fromDayNumber(toDayNumber(date)).getTime()).toBe(date.getTime());
  });

  it('stores no time of day', () => {
    const d = fromDayNumber(toDayNumber(new Date(2026, 7, 16, 15, 42, 9)));
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe('scheduling', () => {
  const today = 20_000;

  it('schedules from the level being moved to', () => {
    expect(dueDayFor(5, today)).toBe(today + 14);
  });

  it('derives last-studied rather than storing it', () => {
    const due = dueDayFor(5, today);
    expect(lastStudiedFrom(5, due)).toBe(today);
  });

  it('reports overdue as a positive number of days late', () => {
    expect(overdueBy(today - 12, today)).toBe(12);
    expect(overdueBy(today + 3, today)).toBe(-3);
  });

  it('counts a card due on the day itself', () => {
    expect(isDue(today, today)).toBe(true);
    expect(isDue(today - 1, today)).toBe(true);
    expect(isDue(today + 1, today)).toBe(false);
  });
});
