import { describe, expect, it } from 'vitest';
import { buildFormMap, foldToLemmas, parseFrequencyList } from './frequency';
import { capSenses, isMarginal, SENSE_CAP } from './senses';
import type { SenseCandidate } from './kaikki';

function candidate(
  term: string,
  glosses: string[],
  sourceIndex: number,
  tags: string[] = [],
  partOfSpeech = 'noun',
): SenseCandidate {
  return {
    language: 'es',
    term,
    partOfSpeech,
    glosses,
    tags,
    topics: [],
    examples: [],
    sourceIndex,
  };
}

describe('parsing a frequency list', () => {
  it('reads word/count pairs and skips junk', () => {
    const parsed = parseFrequencyList('de 1000\ncasa 300\n\nbroken\nCASA 5\n');
    expect(parsed).toEqual([
      { term: 'de', count: 1000 },
      { term: 'casa', count: 300 },
      { term: 'casa', count: 5 },
    ]);
  });
});

describe('folding inflections onto their lemma', () => {
  it('sums a lemma with its forms, which changes the ranking', () => {
    // Unfolded, `siempre` outranks `casa`. Folded, `casa` wins — which is the
    // whole point: a noun's frequency is spread across its forms.
    const entries = parseFrequencyList('siempre 500\ncasa 300\ncasas 250\n');
    const formMap = buildFormMap([{ form: 'casas', lemma: 'casa' }]);
    const ranks = foldToLemmas(entries, formMap);

    expect(ranks.get('casa')).toBe(1);
    expect(ranks.get('siempre')).toBe(2);
    expect(ranks.has('casas')).toBe(false);
  });

  it('leaves a form claimed by two lemmas unmapped rather than guessing', () => {
    const formMap = buildFormMap([
      { form: 'cero', lemma: 'cerar' },
      { form: 'cero', lemma: 'cerner' },
    ]);
    expect(formMap.has('cero')).toBe(false);
  });

  it('counts an unmapped form on its own rather than dropping it', () => {
    const entries = parseFrequencyList('raro 10\n');
    const ranks = foldToLemmas(entries, new Map());
    expect(ranks.get('raro')).toBe(1);
  });

  it('ignores a link from a word to itself', () => {
    expect(buildFormMap([{ form: 'casa', lemma: 'casa' }]).size).toBe(0);
  });
});

describe('the sense cap', () => {
  it('keeps three and drops the fourth, as banco does', () => {
    const groups = capSenses([
      candidate('banco', ['bank (financial institution)'], 0),
      candidate('banco', ['bench'], 1),
      candidate('banco', ['pew'], 2),
      candidate('banco', ['school of fish'], 3),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.kept).toHaveLength(SENSE_CAP);
    expect(groups[0]!.kept.map((s) => s.glosses[0])).toEqual([
      'bank (financial institution)',
      'bench',
      'pew',
    ]);
    expect(groups[0]!.dropped.map((d) => d.sense.glosses[0])).toEqual(['school of fish']);
  });

  it('drops marginal senses before truncating by order', () => {
    // Without the marginal rule, source order would keep the archaic sense and
    // drop the everyday one purely because it happened to be listed later.
    const groups = capSenses([
      candidate('x', ['archaic sense'], 0, ['archaic']),
      candidate('x', ['common one'], 1),
      candidate('x', ['common two'], 2),
      candidate('x', ['common three'], 3),
    ]);

    expect(groups[0]!.kept.map((s) => s.glosses[0])).toEqual([
      'common one',
      'common two',
      'common three',
    ]);
    expect(groups[0]!.dropped[0]).toMatchObject({ reason: 'marginal' });
  });

  it('keeps a marginal sense when there are too few central ones to fill the cap', () => {
    const groups = capSenses([
      candidate('y', ['rare one'], 0, ['rare']),
      candidate('y', ['rare two'], 1, ['rare']),
      candidate('y', ['central'], 2),
    ]);
    expect(groups[0]!.kept).toHaveLength(3);
    expect(groups[0]!.dropped).toEqual([]);
  });

  it('separates the same spelling under different parts of speech', () => {
    const groups = capSenses([
      candidate('banco', ['bank'], 0, [], 'noun'),
      candidate('banco', ['I bench'], 0, [], 'verb'),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('recognizes a marginal label', () => {
    expect(isMarginal(candidate('z', ['g'], 0, ['obsolete']))).toBe(true);
    expect(isMarginal(candidate('z', ['g'], 0, ['masculine']))).toBe(false);
  });
});
