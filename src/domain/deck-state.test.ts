import { describe, expect, it } from 'vitest';
import { computeDeckState, type DeckStateInput } from './deck-state';
import type { WordKey, WordProgress } from './types';

const TODAY = 20_000;
const VECTORS = ['recognition', 'production'];

const input = (
  memberKeys: readonly WordKey[],
  progress: ReadonlyMap<WordKey, WordProgress>,
  requeryMastered = false,
  over: Partial<DeckStateInput> = {},
): DeckStateInput => ({
  memberKeys,
  progress,
  enabledVectors: VECTORS,
  requeryMastered,
  today: TODAY,
  cardCap: 20,
  newWordsPerDay: 5,
  ...over,
});

const word = (
  key: WordKey,
  level: number,
  dueDay: number,
  introducedOn = TODAY - 30,
): [WordKey, WordProgress] => [
  key,
  {
    key,
    introducedOn,
    vectors: { recognition: { level, dueDay }, production: { level, dueDay } },
  },
];

describe('empty', () => {
  it('reports empty for a deck with no members', () => {
    expect(computeDeckState(input([], new Map())).status).toBe('empty');
  });

  it('reports empty when every member is hidden', () => {
    const progress = new Map<WordKey, WordProgress>([
      ['h', { key: 'h', hidden: true, introducedOn: TODAY, vectors: {} }],
    ]);
    expect(computeDeckState(input(['h'], progress)).status).toBe('empty');
  });
});

describe('due', () => {
  it('counts words never introduced as available now', () => {
    const state = computeDeckState(input(['a', 'b'], new Map()));
    expect(state.status).toBe('due');
    expect(state.newCount).toBe(2);
    expect(state.dueCount).toBe(2);
  });

  it('reports what a session would SERVE, not raw availability', () => {
    // Seven unlearned words but a budget of three: advertising seven would
    // promise cards the session will not deal.
    const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const state = computeDeckState(input(keys, new Map(), false, { newWordsPerDay: 3 }));
    expect(state.newCount).toBe(7);
    expect(state.dueCount).toBe(3);
  });

  it('never advertises more than the card cap', () => {
    const keys = Array.from({ length: 30 }, (_, i) => `w${i}`);
    const progress = new Map(keys.map((k) => word(k, 3, TODAY)));
    const state = computeDeckState(input(keys, progress, false, { cardCap: 8 }));
    expect(state.dueCount).toBe(8);
  });

  it('counts reviews that have come around', () => {
    const state = computeDeckState(input(['a'], new Map([word('a', 3, TODAY)])));
    expect(state.status).toBe('due');
    expect(state.dueCount).toBe(1);
  });

  it('surfaces the backlog so the new-word lever can be used', () => {
    const progress = new Map([word('a', 3, TODAY - 10), word('b', 3, TODAY)]);
    const state = computeDeckState(input(['a', 'b'], progress));
    // Both vectors of `a` are late, and each counts.
    expect(state.overdueCount).toBe(2);
  });
});

describe('the budget being spent', () => {
  it('is caught up for TODAY, not complete, when new words remain', () => {
    // The words are still there; the day's allowance is not. Saying "complete"
    // would claim the deck was finished when it plainly is not.
    const progress = new Map([
      word('done', 3, TODAY + 5, TODAY),
      ['fresh', { key: 'fresh', vectors: {} } as WordProgress],
    ]);

    const state = computeDeckState(input(['done', 'fresh'], progress, false, {
      newWordsPerDay: 1,
    }));

    expect(state.status).toBe('caughtUp');
    expect(state.dueCount).toBe(0);
    expect(state.newCount).toBe(1);
    expect(state.newAllowedToday).toBe(0);
    expect(state.nextDueDay).toBe(TODAY + 1);
  });

  it('never offers a session it cannot fill', () => {
    const progress = new Map([word('done', 3, TODAY + 5, TODAY)]);
    const state = computeDeckState(input(['done'], progress, false, { newWordsPerDay: 1 }));
    expect(state.dueCount).toBe(0);
  });
});

describe('caught up', () => {
  it('reports the next due day when work remains scheduled', () => {
    const state = computeDeckState(input(['a'], new Map([word('a', 5, TODAY + 6)])));
    expect(state.status).toBe('caughtUp');
    expect(state.dueCount).toBe(0);
    expect(state.nextDueDay).toBe(TODAY + 6);
  });

  it('picks the soonest of several future days', () => {
    const progress = new Map([word('a', 5, TODAY + 20), word('b', 5, TODAY + 2)]);
    expect(computeDeckState(input(['a', 'b'], progress)).nextDueDay).toBe(TODAY + 2);
  });
});

describe('complete', () => {
  it('is reached when every word is mastered and check-ups are off', () => {
    const progress = new Map([word('a', 9, TODAY - 1), word('b', 9, TODAY - 1)]);
    const state = computeDeckState(input(['a', 'b'], progress));
    expect(state.status).toBe('complete');
    expect(state.nextDueDay).toBeUndefined();
  });

  it('is NOT the same as empty — the win state must be distinguishable', () => {
    const progress = new Map([word('a', 9, TODAY - 1)]);
    const complete = computeDeckState(input(['a'], progress));
    const empty = computeDeckState(input([], new Map()));

    expect(complete.status).toBe('complete');
    expect(empty.status).toBe('empty');
    expect(complete.status).not.toBe(empty.status);
  });

  it('becomes due again once check-ups are switched on', () => {
    const progress = new Map([word('a', 9, TODAY - 1)]);
    expect(computeDeckState(input(['a'], progress, true)).status).toBe('due');
  });
});

describe('distribution', () => {
  it('buckets words by their highest level', () => {
    const progress = new Map([
      word('learning', 2, TODAY + 1),
      word('mature', 6, TODAY + 1),
      word('mastered', 9, TODAY + 1),
    ]);
    const state = computeDeckState(
      input(['learning', 'mature', 'mastered', 'unseen'], progress),
    );

    expect(state.distribution).toEqual({
      new: 1,
      learning: 1,
      mature: 1,
      mastered: 1,
    });
  });
});
