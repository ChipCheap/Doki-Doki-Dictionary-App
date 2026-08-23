import { describe, expect, it } from 'vitest';
import { intervalForLevel } from './ladder';
import {
  levelOf,
  matchesProgressFilter,
  planMassEdit,
  staggerRate,
  type SelectableWord,
} from './maintenance';
import type { WordKey, WordProgress } from './types';

const VECTORS = ['recognition', 'production'];
const TODAY = 20_000;

function word(key: string, term = key, partOfSpeech = 'noun'): SelectableWord {
  return { key, term, partOfSpeech };
}

function progressOf(
  entries: Record<string, Partial<Record<string, { level: number; dueDay: number }>>>,
  extra: Record<string, { introducedOn?: number; hidden?: boolean }> = {},
): Map<WordKey, WordProgress> {
  const map = new Map<WordKey, WordProgress>();
  for (const [key, vectors] of Object.entries(entries)) {
    map.set(key, { key, vectors, ...(extra[key] ?? {}) });
  }
  for (const [key, flags] of Object.entries(extra)) {
    if (!map.has(key)) map.set(key, { key, vectors: {}, ...flags });
  }
  return map;
}

describe('levelOf', () => {
  it('treats a vector with no stored row as level 0', () => {
    expect(levelOf(undefined, 'recognition')).toBe(0);
    expect(levelOf({ key: 'a', vectors: {} }, 'recognition')).toBe(0);
  });
});

describe('matchesProgressFilter', () => {
  it('selects never-studied words for a range starting at 0', () => {
    // The framework's headline case: "I already know all 1,000 Basic words"
    // must actually select them, and they have no rows at all.
    expect(
      matchesProgressFilter(undefined, { levels: { min: 0, max: 2 } }, VECTORS),
    ).toBe(true);
  });

  it('matches when ANY vector is in range and no vector is named', () => {
    const p: WordProgress = {
      key: 'a',
      vectors: { recognition: { level: 8, dueDay: 0 }, production: { level: 1, dueDay: 0 } },
    };
    expect(matchesProgressFilter(p, { levels: { min: 0, max: 2 } }, VECTORS)).toBe(true);
  });

  it('consults only the named vector when one is given', () => {
    const p: WordProgress = {
      key: 'a',
      vectors: { recognition: { level: 8, dueDay: 0 }, production: { level: 1, dueDay: 0 } },
    };
    expect(
      matchesProgressFilter(p, { levels: { min: 0, max: 2 }, vectorId: 'recognition' }, VECTORS),
    ).toBe(false);
    expect(
      matchesProgressFilter(p, { levels: { min: 0, max: 2 }, vectorId: 'production' }, VECTORS),
    ).toBe(true);
  });

  it('excludes hidden words unless asked for', () => {
    const p: WordProgress = { key: 'a', hidden: true, vectors: {} };
    expect(matchesProgressFilter(p, {}, VECTORS)).toBe(false);
    expect(matchesProgressFilter(p, { includeHidden: true }, VECTORS)).toBe(true);
  });
});

describe('planMassEdit — setting a level', () => {
  it('writes EVERY vector, moving one down and one up onto the same level', () => {
    const plan = planMassEdit({
      words: [word('a')],
      progress: progressOf({
        a: { recognition: { level: 2, dueDay: 100 }, production: { level: 8, dueDay: 200 } },
      }),
      operation: { kind: 'setLevel', level: 5 },
      enabledVectors: VECTORS,
      today: TODAY,
      rate: 10,
    });

    expect(plan.writes.map((w) => w.level)).toEqual([5, 5]);
    expect(plan.downwardWords).toBe(1);
  });

  it('counts mastery loss in WORDS, not vectors', () => {
    // Both vectors of `a` drop; that is one word losing mastery, not two
    // separate things the user could deal with separately.
    const plan = planMassEdit({
      words: [word('a'), word('b')],
      progress: progressOf({
        a: { recognition: { level: 8, dueDay: 100 }, production: { level: 7, dueDay: 100 } },
        b: { recognition: { level: 1, dueDay: 100 }, production: { level: 1, dueDay: 100 } },
      }),
      operation: { kind: 'setLevel', level: 5 },
      enabledVectors: VECTORS,
      today: TODAY,
      rate: 10,
    });

    expect(plan.writes.filter((w) => w.level < w.from)).toHaveLength(2);
    expect(plan.downwardWords).toBe(1);
  });

  it('never moves an existing due day, in either direction', () => {
    const plan = planMassEdit({
      words: [word('a')],
      progress: progressOf({
        a: { recognition: { level: 9, dueDay: 40_000 }, production: { level: 9, dueDay: 40_000 } },
      }),
      operation: { kind: 'setLevel', level: 6 },
      enabledVectors: VECTORS,
      today: TODAY,
      rate: 10,
    });

    expect(plan.writes.every((w) => w.dueDay === 40_000)).toBe(true);
    expect(plan.writes.every((w) => !w.scheduled)).toBe(true);
  });

  it('marks never-studied words as introduced', () => {
    const plan = planMassEdit({
      words: [word('a'), word('b')],
      progress: progressOf({ a: { recognition: { level: 3, dueDay: 30_000 } } }, {
        a: { introducedOn: 19_000 },
      }),
      operation: { kind: 'setLevel', level: 5 },
      enabledVectors: VECTORS,
      today: TODAY,
      rate: 10,
    });

    expect(plan.introduced).toEqual(['b']);
  });
});

describe('planMassEdit — the stagger', () => {
  const thousand = Array.from({ length: 1000 }, (_, i) => word(`w${i}`));

  function due(level: number, rate: number): number[] {
    return planMassEdit({
      words: thousand,
      progress: new Map(),
      operation: { kind: 'setLevel', level },
      enabledVectors: VECTORS,
      today: TODAY,
      rate,
    }).writes.map((w) => w.dueDay);
  }

  it('starts at the level interval and spreads at the given rate', () => {
    const days = due(5, 10);
    expect(days[0]).toBe(TODAY + intervalForLevel(5));
    expect(Math.max(...days)).toBe(TODAY + intervalForLevel(5) + 99);
  });

  it('shifts the window by the level but does not compress it', () => {
    const atOne = due(1, 10);
    const atFive = due(5, 10);
    const span = (days: number[]): number => Math.max(...days) - Math.min(...days);

    expect(Math.min(...atOne)).toBe(TODAY + 1);
    expect(Math.min(...atFive)).toBe(TODAY + 14);
    expect(span(atOne)).toBe(span(atFive));
  });

  it('never lands the whole batch on one day', () => {
    const days = due(1, 10);
    expect(new Set(days).size).toBe(100);
  });

  it('gives both vectors of one word the same day', () => {
    const plan = planMassEdit({
      words: [word('a'), word('b')],
      progress: new Map(),
      operation: { kind: 'setLevel', level: 5 },
      enabledVectors: VECTORS,
      today: TODAY,
      rate: 1,
    });

    expect(plan.writes[0]!.dueDay).toBe(plan.writes[1]!.dueDay);
    expect(plan.writes[2]!.dueDay).toBe(plan.writes[3]!.dueDay);
    expect(plan.writes[2]!.dueDay).toBe(plan.writes[0]!.dueDay + 1);
  });

  it('takes half the card cap as its rate', () => {
    expect(staggerRate(20)).toBe(10);
    expect(staggerRate(1)).toBe(1);
    expect(staggerRate(0)).toBe(1);
  });
});

describe('planMassEdit — the other two operations', () => {
  it('writes no progress rows for hide/unhide', () => {
    const plan = planMassEdit({
      words: [word('a'), word('b')],
      progress: new Map(),
      operation: { kind: 'setHidden', hidden: true },
      enabledVectors: VECTORS,
      today: TODAY,
      rate: 10,
    });

    expect(plan.writes).toEqual([]);
    expect(plan.downwardWords).toBe(0);
    expect(plan.wordKeys).toEqual(['a', 'b']);
  });

  it('writes no progress rows for deck membership', () => {
    const plan = planMassEdit({
      words: [word('a')],
      progress: new Map(),
      operation: { kind: 'deckMembership', action: 'add', deckId: 'deck_1' },
      enabledVectors: VECTORS,
      today: TODAY,
      rate: 10,
    });

    expect(plan.writes).toEqual([]);
    expect(plan.wordsAffected).toBe(1);
  });
});

describe('planMassEdit — the sample', () => {
  it('spreads across the selection rather than taking the first N', () => {
    const words = [
      ...Array.from({ length: 50 }, (_, i) => word(`a${i}`, `a${i}`, 'noun')),
      ...Array.from({ length: 50 }, (_, i) => word(`z${i}`, `z${i}`, 'verb')),
    ];

    const plan = planMassEdit({
      words,
      progress: new Map(),
      operation: { kind: 'setHidden', hidden: true },
      enabledVectors: VECTORS,
      today: TODAY,
      rate: 10,
      sampleSize: 20,
    });

    // A mis-aimed selection is only visible if the sample reaches the far end.
    expect(plan.sample.some((r) => r.partOfSpeech === 'verb')).toBe(true);
    expect(plan.sample.some((r) => r.partOfSpeech === 'noun')).toBe(true);
  });

  it('is empty when nothing is selected', () => {
    const plan = planMassEdit({
      words: [],
      progress: new Map(),
      operation: { kind: 'setLevel', level: 5 },
      enabledVectors: VECTORS,
      today: TODAY,
      rate: 10,
    });

    expect(plan.sample).toEqual([]);
    expect(plan.wordsAffected).toBe(0);
  });
});
