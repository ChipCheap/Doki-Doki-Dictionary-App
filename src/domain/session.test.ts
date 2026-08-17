import { describe, expect, it } from 'vitest';
import { composeSession, type SessionSettings } from './session';
import type { DeckMember, Rng, WordKey, WordProgress } from './types';

const TODAY = 20_000;

/** Deterministic: always picks the first candidate. */
const firstRng: Rng = () => 0;

const settings = (over: Partial<SessionSettings> = {}): SessionSettings => ({
  cardCap: 20,
  newWordsPerDay: 5,
  enabledVectors: ['recognition', 'production'],
  requeryMastered: false,
  ...over,
});

const member = (key: WordKey): DeckMember => ({ key, difficulty: 'common' });

const seen = (
  key: WordKey,
  vectors: WordProgress['vectors'],
  introducedOn = TODAY - 30,
): [WordKey, WordProgress] => [key, { key, introducedOn, vectors }];

describe('new words', () => {
  it('claim slots before reviews do', () => {
    // Priority is about which cards get INTO the session, not where they appear
    // — the queue is shuffled afterwards so new words land throughout.
    const members = [member('new-1'), member('due-1')];
    const progress = new Map([
      seen('due-1', {
        recognition: { level: 3, dueDay: TODAY - 5 },
        production: { level: 3, dueDay: TODAY - 5 },
      }),
    ]);

    const r = composeSession({
      members,
      progress,
      settings: settings({ cardCap: 1 }),
      today: TODAY,
      rng: firstRng,
    });

    expect(r.queue).toHaveLength(1);
    expect(r.queue[0]?.wordKey).toBe('new-1');
    expect(r.queue[0]?.isNew).toBe(true);
  });

  it('are capped by the daily budget', () => {
    const members = Array.from({ length: 20 }, (_, i) => member(`n${i}`));
    const r = composeSession({
      members,
      progress: new Map(),
      settings: settings({ newWordsPerDay: 3 }),
      today: TODAY,
      rng: firstRng,
    });
    expect(r.newCount).toBe(3);
  });

  it('count words already introduced today against the budget', () => {
    const members = [member('a'), member('b'), member('c')];
    const progress = new Map([seen('a', {}, TODAY), seen('b', {}, TODAY)]);

    const r = composeSession({
      members,
      progress,
      settings: settings({ newWordsPerDay: 3 }),
      today: TODAY,
      rng: firstRng,
    });
    expect(r.newCount).toBe(1);
  });

  it('stop entirely when the budget is zero — the catch-up lever', () => {
    const members = [member('a'), member('b')];
    const r = composeSession({
      members,
      progress: new Map(),
      settings: settings({ newWordsPerDay: 0 }),
      today: TODAY,
      rng: firstRng,
    });
    expect(r.newCount).toBe(0);
  });
});

describe('one word, one card', () => {
  it('never serves both vectors of the same word', () => {
    const progress = new Map([
      seen('w', {
        recognition: { level: 2, dueDay: TODAY - 1 },
        production: { level: 4, dueDay: TODAY - 1 },
      }),
    ]);

    const r = composeSession({
      members: [member('w')],
      progress,
      settings: settings(),
      today: TODAY,
      rng: firstRng,
    });

    expect(r.queue).toHaveLength(1);
  });

  it('serves the lower-level vector when several are due', () => {
    const progress = new Map([
      seen('w', {
        recognition: { level: 6, dueDay: TODAY - 1 },
        production: { level: 2, dueDay: TODAY - 1 },
      }),
    ]);

    const r = composeSession({
      members: [member('w')],
      progress,
      settings: settings(),
      today: TODAY,
      rng: firstRng,
    });

    expect(r.queue[0]?.vectorId).toBe('production');
  });

  it('serves the only due vector even when it has the higher level', () => {
    // A vector that is not due is never a candidate, whatever its level.
    const progress = new Map([
      seen('w', {
        recognition: { level: 2, dueDay: TODAY + 10 },
        production: { level: 7, dueDay: TODAY - 1 },
      }),
    ]);

    const r = composeSession({
      members: [member('w')],
      progress,
      settings: settings(),
      today: TODAY,
      rng: firstRng,
    });

    expect(r.queue[0]?.vectorId).toBe('production');
  });
});

describe('review ordering and limits', () => {
  it('selects the most overdue cards when the cap truncates', () => {
    // The queue is shuffled for presentation, so the ordering rule is only
    // observable in WHICH cards survive the cap — which is the part that
    // matters: a mis-ranked word is dropped from the session entirely.
    const both = (level: number, dueDay: number) => ({
      recognition: { level, dueDay },
      production: { level, dueDay },
    });
    const progress = new Map([
      seen('slightly', both(3, TODAY - 1)),
      seen('badly', both(3, TODAY - 40)),
      seen('today', both(3, TODAY)),
    ]);

    const r = composeSession({
      members: [member('slightly'), member('badly'), member('today')],
      progress,
      settings: settings({ cardCap: 2 }),
      today: TODAY,
      rng: firstRng,
    });

    expect(r.queue.map((c) => c.wordKey).sort()).toEqual(['badly', 'slightly']);
    expect(r.deferred).toBe(1);
  });

  it('ranks an un-quizzed vector by when the word was introduced', () => {
    // Without this the word would rank as zero-overdue and be cut first,
    // despite being the most neglected thing in the deck.
    const progress = new Map([
      seen('neglected', { recognition: { level: 3, dueDay: TODAY + 30 } }, TODAY - 90),
      seen('fresh', { recognition: { level: 3, dueDay: TODAY - 1 }, production: { level: 3, dueDay: TODAY - 1 } }),
    ]);

    const r = composeSession({
      members: [member('neglected'), member('fresh')],
      progress,
      settings: settings({ cardCap: 1 }),
      today: TODAY,
      rng: firstRng,
    });

    expect(r.queue[0]?.wordKey).toBe('neglected');
    expect(r.queue[0]?.vectorId).toBe('production');
  });

  it('never exceeds the card cap', () => {
    const members = Array.from({ length: 50 }, (_, i) => member(`w${i}`));
    const progress = new Map(
      members.map((m) => seen(m.key, { recognition: { level: 3, dueDay: TODAY - 1 } })),
    );

    const r = composeSession({
      members,
      progress,
      settings: settings({ cardCap: 7 }),
      today: TODAY,
      rng: firstRng,
    });

    expect(r.queue).toHaveLength(7);
    expect(r.deferred).toBe(43);
  });

  it('omits cards that are not yet due', () => {
    // Both vectors must be scheduled forward: an introduced word with an
    // un-quizzed vector has that vector due at level 0, by design.
    const progress = new Map([
      seen('later', {
        recognition: { level: 5, dueDay: TODAY + 3 },
        production: { level: 4, dueDay: TODAY + 1 },
      }),
    ]);
    const r = composeSession({
      members: [member('later')],
      progress,
      settings: settings(),
      today: TODAY,
      rng: firstRng,
    });
    expect(r.queue).toHaveLength(0);
  });
});

describe('mastery and hiding', () => {
  it('withholds mastered words by default', () => {
    const progress = new Map([
      seen('m', {
        recognition: { level: 9, dueDay: TODAY - 1 },
        production: { level: 9, dueDay: TODAY - 1 },
      }),
    ]);
    const r = composeSession({
      members: [member('m')],
      progress,
      settings: settings(),
      today: TODAY,
      rng: firstRng,
    });
    expect(r.queue).toHaveLength(0);
  });

  it('serves them when the deck asks for check-ups', () => {
    const progress = new Map([
      seen('m', {
        recognition: { level: 9, dueDay: TODAY - 1 },
        production: { level: 9, dueDay: TODAY - 1 },
      }),
    ]);
    const r = composeSession({
      members: [member('m')],
      progress,
      settings: settings({ requeryMastered: true }),
      today: TODAY,
      rng: firstRng,
    });
    expect(r.queue).toHaveLength(1);
  });

  it('never serves a hidden word', () => {
    const progress = new Map<WordKey, WordProgress>([
      ['h', { key: 'h', hidden: true, introducedOn: TODAY - 5, vectors: { recognition: { level: 1, dueDay: TODAY - 1 } } }],
    ]);
    const r = composeSession({
      members: [member('h')],
      progress,
      settings: settings(),
      today: TODAY,
      rng: firstRng,
    });
    expect(r.queue).toHaveLength(0);
  });
});
