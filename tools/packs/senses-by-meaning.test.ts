/**
 * Sense-level decisions: which sentence illustrates which sense, which senses
 * are banded down for lack of use, and which proper names are vocabulary.
 *
 * Each case is a defect observed in a real build, not a hypothetical.
 */
import { describe, expect, it } from 'vitest';
import { isDemotedForEvidence, isUnattested, tierFor } from './difficulty';
import { assembleExamples, englishStems, routeSentences, type TatoebaCorpus } from './examples';
import { keepNames, nameVerdict, type KaikkiSense, type NameVerdict, type SenseCandidate } from './kaikki';

function corpusOf(translations: Record<string, string>): TatoebaCorpus {
  const byId = new Map(
    Object.entries(translations).map(([id, translation]) => [id, { id, text: `vi ${id}`, translation }]),
  );
  return { byId, byToken: new Map() };
}

function candidate(term: string, glosses: string[], partOfSpeech = 'noun'): SenseCandidate {
  return {
    language: 'vi',
    term,
    partOfSpeech,
    glosses,
    tags: [],
    topics: [],
    examples: [],
    sourceIndex: 0,
  };
}

describe('routing corpus sentences to senses', () => {
  it('gives a gun sentence to "gun", not to the water lily listed first', () => {
    const corpus = corpusOf({ s1: 'He leveled his gun at me.', s2: 'Guns are dangerous.' });
    const routed = routeSentences([['water lily'], ['gun']], ['s1', 's2'], corpus);
    expect(routed.bySense).toEqual([[], ['s1', 's2']]);
    expect(routed.matched).toEqual([0, 2]);
  });

  it('meets inflected English with a bare gloss', () => {
    const corpus = corpusOf({ s1: "I'm bored.", s2: 'Tom has the right to vote.' });
    const routed = routeSentences([['to bore; to tire'], ['to vote']], ['s1', 's2'], corpus);
    expect(routed.bySense).toEqual([['s1'], ['s2']]);
  });

  it('gives a tie to the earlier sense rather than dropping it', () => {
    // "to eat" and "to eat with (a utensil)" both reduce to "eat".
    const corpus = corpusOf({ s1: 'Why don\'t you eat?' });
    const routed = routeSentences([['to eat'], ['to eat with (a utensil)']], ['s1'], corpus);
    expect(routed.bySense).toEqual([['s1'], []]);
  });

  it('does not route on a light verb alone when the gloss has more to say', () => {
    const corpus = corpusOf({ s1: 'He stopped to make speeches.' });
    const routed = routeSentences(
      [['again'], ["to make up for one's disadvantage"]],
      ['s1'],
      corpus,
    );
    expect(routed.matched).toEqual([0, 0]);
  });

  it('lets a gloss that IS a light verb match on it', () => {
    const corpus = corpusOf({ s1: 'Come here!' });
    const routed = routeSentences([['again'], ['to come']], ['s1'], corpus);
    expect(routed.bySense).toEqual([[], ['s1']]);
  });

  it('matches a gloss made only of stopwords, like "to do"', () => {
    const corpus = corpusOf({ s1: 'What do you do?' });
    const routed = routeSentences([['into'], ['to do']], ['s1'], corpus);
    expect(routed.bySense).toEqual([[], ['s1']]);
  });

  it('gives unmatched sentences to a clearly dominant sense, but never counts them', () => {
    const corpus = corpusOf({
      a: 'Say it again.',
      b: 'Call again later.',
      c: 'Bring that here!', // paraphrase: matches nothing
    });
    const routed = routeSentences([['again'], ['to recover']], ['a', 'b', 'c'], corpus);
    expect(routed.bySense).toEqual([['a', 'b', 'c'], []]);
    expect(routed.matched).toEqual([2, 0]);
    expect(routed.unrouted).toBe(0);
  });

  it('leaves unmatched sentences out when no sense dominates', () => {
    const corpus = corpusOf({ a: 'A gun.', b: 'A water lily.', c: 'Something else.' });
    const routed = routeSentences([['water lily'], ['gun']], ['a', 'b', 'c'], corpus);
    expect(routed.bySense).toEqual([['b'], ['a']]);
    expect(routed.unrouted).toBe(1);
  });

  it('gives a single-sense term every sentence, as before', () => {
    const corpus = corpusOf({ a: 'Anything at all.' });
    expect(routeSentences([['house']], ['a'], corpus).bySense).toEqual([['a']]);
  });

  it('assembles only the routed sentences, after Wiktionary’s own', () => {
    const corpus = corpusOf({ s1: 'He leveled his gun at me.' });
    const { core } = assembleExamples([{ text: 'Súng nổ.' }], corpus, ['s1']);
    expect(core.map((e) => e.id.split(':')[0])).toEqual(['wikt', 'tatoeba']);
    expect(assembleExamples([], corpus, []).core).toEqual([]);
  });

  it('ignores parenthesised qualifiers in a gloss', () => {
    // "(a country in South Asia)" must not claim every sentence about a country.
    const corpus = corpusOf({ s1: 'This country is large.' });
    const routed = routeSentences([['India (a country in South Asia)'], ['large; big']], ['s1'], corpus);
    expect(routed.bySense).toEqual([[], ['s1']]);
    expect(englishStems('Guns and voting')).toEqual(new Set(['gun', 'vot']));
  });
});

describe('banding senses by usage evidence', () => {
  const ranks = new Map([['lại', 10]]);

  it('bands an unused sense of a common word one harder', () => {
    const sense = candidate('lại', ['to recover'], 'verb');
    expect(tierFor(sense, ranks, { sense: 0, term: 40, senses: 6 })).toBe('common');
  });

  it('treats a sliver of the evidence as unused', () => {
    expect(isUnattested({ sense: 1, term: 100, senses: 6 })).toBe(true);
    expect(isUnattested({ sense: 10, term: 100, senses: 6 })).toBe(false);
  });

  it('keeps the tier when there is too little evidence to judge', () => {
    expect(isUnattested({ sense: 0, term: 2, senses: 3 })).toBe(false);
  });

  it('never bands a single-sense term', () => {
    expect(isUnattested({ sense: 0, term: 50, senses: 1 })).toBe(false);
  });

  it('never bands parts of speech whose glosses describe rather than translate', () => {
    const particle = candidate('đi', ['at the end of a sentence, conveys a command'], 'particle');
    expect(isDemotedForEvidence(particle, { sense: 0, term: 50, senses: 5 })).toBe(false);
    expect(tierFor(particle, new Map([['đi', 5]]), { sense: 0, term: 50, senses: 5 })).toBe('basic');
  });

  it('bands advanced no further — niche means specialist, not rare', () => {
    const sense = candidate('lại', ['to recover'], 'verb');
    expect(tierFor(sense, new Map(), { sense: 0, term: 40, senses: 6 })).toBe('advanced');
  });
});

describe('which proper names are vocabulary', () => {
  const sense = (categories: string[] = []): KaikkiSense => ({ categories: categories.map((name) => ({ name })) });

  it('drops people, spellings, scientific names and acronyms', () => {
    expect(nameVerdict('Acero', ['a surname'], sense())).toBe('drop');
    expect(nameVerdict('Tí', ['a unisex home name'], sense())).toBe('drop');
    expect(nameVerdict('Hòa', ['Traditional tone placement spelling of Hoà'], sense())).toBe('drop');
    expect(nameVerdict('Người', ['Hominidae'], sense())).toBe('drop');
    expect(nameVerdict('AVE', ['a high-speed rail service in Spain'], sense())).toBe('drop');
  });

  it('recognises countries, continents, languages and the sun', () => {
    expect(nameVerdict('Đức', ['Germany (a country in Central Europe)'], sense())).toBe('major');
    expect(nameVerdict('châu Âu', ['Europe (a continent located west of Asia)'], sense())).toBe('major');
    expect(nameVerdict('tiếng Đức', ['German language'], sense())).toBe('major');
    expect(nameVerdict('Mặt Trời', ['Sun'], sense())).toBe('major');
  });

  it('does not take "the country" deep in a gloss for a country', () => {
    expect(
      nameVerdict('Victoria', ['Victoria (a state of Australia, located in the southeast of the country)'], sense()),
    ).toBe('minor-place');
  });

  it('keeps names that are words and drops homographs riding a common word', () => {
    const cometa = candidate('Cometa', ['Comet (reindeer)'], 'name');
    const cometaNoun = candidate('cometa', ['comet']);
    const hanoi = candidate('Hà Nội', ['Hanoi (a city, the capital city of Vietnam)'], 'name');
    const sociedad = candidate('Sociedad', ['a town in Morazán department, El Salvador'], 'name');
    const elSalvador = candidate('El Salvador', ['El Salvador (a country in Central America)'], 'name');
    const trungHoa = candidate('Trung Hoa', ['China'], 'name');
    const trungQuoc = candidate('Trung Quốc', ['China'], 'name');
    const trungQuocAdj = candidate('Trung Quốc', ['Chinese'], 'adj');

    const verdicts = new Map<SenseCandidate, NameVerdict>([
      [cometa, 'other'],
      [hanoi, 'capital'],
      [sociedad, 'minor-place'],
      [elSalvador, 'major'],
      [trungHoa, 'major'],
      [trungQuoc, 'other'],
    ]);
    const kept = keepNames(
      [cometa, cometaNoun, hanoi, sociedad, elSalvador, trungHoa, trungQuoc, trungQuocAdj],
      verdicts,
    );

    expect(kept).toContain(cometaNoun);
    expect(kept).not.toContain(cometa);
    expect(kept).toContain(hanoi);
    // "El Salvador" in its gloss must not make the town a country.
    expect(kept).not.toContain(sociedad);
    // "China" is a known country name, so the homograph survives.
    expect(kept).toContain(trungQuoc);
  });
});
