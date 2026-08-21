import { describe, expect, it } from 'vitest';
import { isAnswerable, pickDistractors, type DistractorCandidate } from './distractors';
import type { Rng } from './types';

const rng: Rng = () => 0;

const candidate = (
  key: string,
  targetTerm: string,
  partOfSpeech: string,
  displayed: string,
): DistractorCandidate => ({ key, targetTerm, partOfSpeech, displayed });

const correct = candidate('es:banco:noun:1', 'banco', 'noun', 'bank');

const nouns = [
  candidate('es:mesa:noun:1', 'mesa', 'noun', 'table'),
  candidate('es:silla:noun:1', 'silla', 'noun', 'chair'),
  candidate('es:puerta:noun:1', 'puerta', 'noun', 'door'),
  candidate('es:libro:noun:1', 'libro', 'noun', 'book'),
];

const verbs = [
  candidate('es:correr:verb:1', 'correr', 'verb', 'to run'),
  candidate('es:comer:verb:1', 'comer', 'verb', 'to eat'),
];

describe('option construction', () => {
  it('builds four options including the correct one', () => {
    const r = pickDistractors({ correct, deckPool: nouns, dictionaryPool: [], rng });
    expect(r.options).toHaveLength(4);
    expect(r.options).toContainEqual(correct);
    expect(r.short).toBe(false);
  });

  it('never repeats an option', () => {
    const r = pickDistractors({ correct, deckPool: nouns, dictionaryPool: nouns, rng });
    const keys = r.options.map((o) => o.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('the same-spelling exclusion', () => {
  it('never offers a sibling sense of the same word', () => {
    // `banco` exists twice — bank and bench. Offering both would mark a user
    // wrong for knowing the word.
    const sibling = candidate('es:banco:noun:2', 'banco', 'noun', 'bench');
    const r = pickDistractors({
      correct,
      deckPool: [sibling, ...nouns],
      dictionaryPool: [],
      rng,
    });
    expect(r.options.map((o) => o.displayed)).not.toContain('bench');
  });

  it('never offers the same text twice, even from different entries', () => {
    // `salir` and `dejar` are different words that both mean "to leave".
    // Showing both would put two identical options on screen, one of which is
    // arbitrarily wrong.
    const salir = candidate('es:salir:verb:1', 'salir', 'verb', 'to leave');
    const dejar = candidate('es:dejar:verb:1', 'dejar', 'verb', 'to leave');
    const r = pickDistractors({
      correct,
      deckPool: [salir, dejar, ...nouns],
      dictionaryPool: [],
      rng,
    });

    const labels = r.options.map((o) => o.displayed);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('never offers the correct answer twice under another key', () => {
    const duplicate = candidate('es:otro:noun:1', 'otro', 'noun', 'bank');
    const r = pickDistractors({
      correct,
      deckPool: [duplicate, ...nouns],
      dictionaryPool: [],
      rng,
    });
    expect(r.options.filter((o) => o.displayed === 'bank')).toHaveLength(1);
  });
});

describe('pool preference', () => {
  it('draws from the deck before the wider dictionary', () => {
    // Deck-first closes a leak: if the answer always came from the deck and the
    // distractors always from outside it, the user learns to pick the familiar
    // word instead of translating.
    const dictOnly = [candidate('es:raro:noun:1', 'raro', 'noun', 'oddity')];
    const r = pickDistractors({
      correct,
      deckPool: nouns,
      dictionaryPool: dictOnly,
      rng,
    });
    expect(r.options.map((o) => o.displayed)).not.toContain('oddity');
  });

  it('falls back to the dictionary when the deck is too thin', () => {
    const r = pickDistractors({
      correct,
      deckPool: [nouns[0]!],
      dictionaryPool: nouns.slice(1),
      rng,
    });
    expect(r.options).toHaveLength(4);
  });
});

describe('the degradation ladder', () => {
  it('prefers the same part of speech', () => {
    const r = pickDistractors({
      correct,
      deckPool: [...nouns, ...verbs],
      dictionaryPool: [],
      rng,
    });
    expect(r.relaxedPartOfSpeech).toBe(false);
    expect(r.options.every((o) => o.partOfSpeech === 'noun')).toBe(true);
  });

  it('relaxes part of speech when too few match', () => {
    const r = pickDistractors({
      correct,
      deckPool: [nouns[0]!, ...verbs],
      dictionaryPool: [],
      rng,
    });
    expect(r.relaxedPartOfSpeech).toBe(true);
    expect(r.options).toHaveLength(4);
  });

  it('accepts fewer options rather than failing — the seed-pack case', () => {
    const r = pickDistractors({
      correct,
      deckPool: [nouns[0]!],
      dictionaryPool: [],
      rng,
    });
    expect(r.options).toHaveLength(2);
    expect(r.short).toBe(true);
    expect(isAnswerable(r)).toBe(true);
  });

  it('reports an unanswerable question rather than pretending', () => {
    const r = pickDistractors({ correct, deckPool: [], dictionaryPool: [], rng });
    expect(r.options).toHaveLength(1);
    expect(isAnswerable(r)).toBe(false);
  });
});

describe('re-presentation', () => {
  it('draws a different set across presentations', () => {
    // Cached distractors mean that by the third exposure you are recognising
    // the set, not the word.
    const pool = Array.from({ length: 12 }, (_, i) =>
      candidate(`es:w${i}:noun:1`, `w${i}`, 'noun', `word ${i}`),
    );
    const seen = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      const r = pickDistractors({ correct, deckPool: pool, dictionaryPool: [] });
      seen.add(
        r.options
          .map((o) => o.key)
          .sort()
          .join('|'),
      );
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
