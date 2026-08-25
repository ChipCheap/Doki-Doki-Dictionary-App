/**
 * H2 — every way a rebuild could silently move a key.
 *
 * Each case starts from the same build-1 registry for `banco` — :1 bank,
 * :2 bench, :3 pew — and feeds it a mutated build-2 source. The failing cases
 * additionally assert that NOTHING was written, since a half-applied registry
 * is itself the corruption this module exists to prevent.
 */

import { describe, expect, it } from 'vitest';
import {
  applyOutcome,
  blockingFailures,
  containment,
  keyOf,
  normalizeTerm,
  pruneRegistry,
  resolve,
  similarity,
  glossTokens,
  EMPTY_REGISTRY,
  MATCH_THRESHOLD,
  type IncomingSense,
  type Registry,
} from './registry';

function sense(glosses: string[], term = 'banco', partOfSpeech = 'noun'): IncomingSense {
  return { language: 'es', term, partOfSpeech, glosses };
}

/** Build 1: the registry as three studied senses left it. */
const BUILD_1: Registry = applyOutcome(
  EMPTY_REGISTRY,
  resolve(EMPTY_REGISTRY, [
    sense(['bank (financial institution)']),
    sense(['bench']),
    sense(['pew']),
  ]),
);

function keyFor(reg: Registry, glossFragment: string): string | undefined {
  return reg.records.find((r) => r.glosses.some((g) => g.includes(glossFragment)))?.key;
}

describe('build 1 — an empty registry', () => {
  it('mints every key and reports it as a first build, not churn', () => {
    const outcome = resolve(EMPTY_REGISTRY, [sense(['bank (financial institution)'])]);
    expect(outcome.churn.firstBuild).toBe(true);
    expect(outcome.churn.minted).toEqual(['es:banco:noun:1']);
    expect(outcome.churn.orphaned).toEqual([]);
    expect(blockingFailures(outcome)).toEqual([]);
  });

  it('numbers senses from 1 in source order', () => {
    expect(BUILD_1.records.map((r) => r.key)).toEqual([
      'es:banco:noun:1',
      'es:banco:noun:2',
      'es:banco:noun:3',
    ]);
    expect(keyFor(BUILD_1, 'financial')).toBe('es:banco:noun:1');
    expect(keyFor(BUILD_1, 'bench')).toBe('es:banco:noun:2');
    expect(keyFor(BUILD_1, 'pew')).toBe('es:banco:noun:3');
  });
});

describe('rebuilding unchanged input', () => {
  it('mints nothing and blocks nothing — the property G18 rests on', () => {
    // Verified against the real extract too: 12,552 Spanish entries rebuilt to
    // 0 minted and 0 blocking. Kept here as a unit so a regression is caught
    // without a 978 MB download.
    const input = [
      sense(['bank (financial institution)']),
      sense(['bench']),
      sense(['pew']),
    ];
    const outcome = resolve(BUILD_1, input);

    expect(outcome.churn.minted).toEqual([]);
    expect(blockingFailures(outcome)).toEqual([]);
    expect(applyOutcome(BUILD_1, outcome).records).toEqual(BUILD_1.records);
  });

  it('does not mistake merely similar senses of one word for a merge', () => {
    // Two senses sharing wording paired off correctly by assignment must not be
    // reported as a merge; checking hit counts before assignment raised 857
    // false alarms on a 42 MB sample.
    const registry = applyOutcome(
      EMPTY_REGISTRY,
      resolve(EMPTY_REGISTRY, [
        sense(['absolutism'], 'absolutismo'),
        sense(['absolutism (political theory)'], 'absolutismo'),
      ]),
    );

    const again = resolve(registry, [
      sense(['absolutism'], 'absolutismo'),
      sense(['absolutism (political theory)'], 'absolutismo'),
    ]);

    expect(blockingFailures(again)).toEqual([]);
  });

  it('treats a function word glossed by function words as distinguishable', () => {
    // Spanish `a` has senses glossed exactly "to", "by" and "at". Filtering
    // stopwords to nothing made all three look identical, so they were flagged
    // ambiguous and then orphaned on every rebuild.
    const senses = [
      sense(['to'], 'a', 'prep'),
      sense(['by'], 'a', 'prep'),
      sense(['at'], 'a', 'prep'),
    ];
    const first = resolve(EMPTY_REGISTRY, senses);
    expect(blockingFailures(first)).toEqual([]);

    const registry = applyOutcome(EMPTY_REGISTRY, first);
    const second = resolve(registry, senses);
    expect(second.churn.minted).toEqual([]);
    expect(blockingFailures(second)).toEqual([]);
  });
});

describe('build 2 — changes that must NOT move a key', () => {
  it('reuses the key when a gloss is reworded', () => {
    // The single most likely real change, and the one an exact-match scheme
    // would get catastrophically wrong.
    const outcome = resolve(BUILD_1, [
      sense(['a financial institution']),
      sense(['bench']),
      sense(['pew']),
    ]);

    expect(blockingFailures(outcome)).toEqual([]);
    expect(outcome.assignments.find((a) => a.sense.glosses[0] === 'a financial institution')?.key)
      .toBe('es:banco:noun:1');
    expect(outcome.churn.minted).toEqual([]);
  });

  it('leaves existing ordinals alone when a sense is inserted first', () => {
    // The case a naive "first encountered wins" scheme gets wrong: sandbank
    // arrives at position 0 and must not push bank off :1.
    const outcome = resolve(BUILD_1, [
      sense(['sandbank']),
      sense(['bank (financial institution)']),
      sense(['bench']),
      sense(['pew']),
    ]);

    expect(blockingFailures(outcome)).toEqual([]);
    const byGloss = new Map(outcome.assignments.map((a) => [a.sense.glosses[0], a.key]));
    expect(byGloss.get('bank (financial institution)')).toBe('es:banco:noun:1');
    expect(byGloss.get('bench')).toBe('es:banco:noun:2');
    expect(byGloss.get('pew')).toBe('es:banco:noun:3');
    expect(byGloss.get('sandbank')).toBe('es:banco:noun:4');
  });

  it('is unaffected by the source reordering its senses', () => {
    const outcome = resolve(BUILD_1, [
      sense(['bench']),
      sense(['pew']),
      sense(['bank (financial institution)']),
    ]);

    expect(blockingFailures(outcome)).toEqual([]);
    const byGloss = new Map(outcome.assignments.map((a) => [a.sense.glosses[0], a.key]));
    expect(byGloss.get('bank (financial institution)')).toBe('es:banco:noun:1');
    expect(byGloss.get('bench')).toBe('es:banco:noun:2');
    expect(byGloss.get('pew')).toBe('es:banco:noun:3');
  });

  it('matches a recased or differently-composed term', () => {
    const composed = 'Banco'.normalize('NFC');
    const decomposed = 'Bánco'.normalize('NFD');

    expect(normalizeTerm(composed)).toBe('banco');
    expect(normalizeTerm(decomposed)).toBe(normalizeTerm('bánco'.normalize('NFC')));

    const outcome = resolve(BUILD_1, [
      sense(['bank (financial institution)'], 'Banco'),
      sense(['bench'], 'BANCO'),
      sense(['pew'], 'banco'),
    ]);
    expect(blockingFailures(outcome)).toEqual([]);
    expect(outcome.churn.minted).toEqual([]);
  });

  it('never folds accents away — sí and si stay different words', () => {
    // Stripping accents would merge two real Spanish words, and with them two
    // separate piles of the user's progress.
    expect(normalizeTerm('sí')).not.toBe(normalizeTerm('si'));
    expect(keyOf('es', 'sí', 'adverb', 1)).not.toBe(keyOf('es', 'si', 'conjunction', 1));
  });
});

describe('build 2 — changes that MUST stop the build', () => {
  it('fails when a sense is removed, rather than orphaning its key', () => {
    const outcome = resolve(BUILD_1, [
      sense(['bank (financial institution)']),
      sense(['bench']),
    ]);

    const blocking = blockingFailures(outcome);
    expect(blocking).toHaveLength(1);
    expect(blocking[0]!.kind).toBe('orphaned-key');
    expect(blocking[0]!.message).toContain('es:banco:noun:3');
  });

  it('fails when two senses merge into one', () => {
    const outcome = resolve(BUILD_1, [
      sense(['bank bench (financial institution seat)']),
      sense(['pew']),
    ]);

    expect(blockingFailures(outcome).some((f) => f.kind === 'merged-senses')).toBe(true);
  });

  it('fails when the source carries two indistinguishable senses', () => {
    const outcome = resolve(BUILD_1, [
      sense(['bank (financial institution)']),
      sense(['bank (financial institution)']),
      sense(['bench']),
      sense(['pew']),
    ]);

    const blocking = blockingFailures(outcome);
    expect(blocking.some((f) => f.kind === 'ambiguous-source')).toBe(true);
    // Not waivable: no later build could tell them apart either.
    expect(blockingFailures(outcome, true).some((f) => f.kind === 'ambiguous-source')).toBe(true);
  });

  it('fails when a part of speech changes, orphaning the old key', () => {
    const outcome = resolve(BUILD_1, [
      sense(['bank (financial institution)'], 'banco', 'verb'),
      sense(['bench']),
      sense(['pew']),
    ]);

    const blocking = blockingFailures(outcome);
    expect(blocking.some((f) => f.kind === 'orphaned-key')).toBe(true);
    expect(outcome.assignments.find((a) => a.sense.partOfSpeech === 'verb')?.key)
      .toBe('es:banco:verb:1');
  });

  it('writes nothing when the build fails', () => {
    // A half-applied registry is the corruption itself, so resolve() must be
    // pure and applyOutcome() must be the only writer.
    const before = JSON.stringify(BUILD_1);
    const outcome = resolve(BUILD_1, [sense(['bank (financial institution)'])]);

    expect(blockingFailures(outcome).length).toBeGreaterThan(0);
    expect(JSON.stringify(BUILD_1)).toBe(before);
  });
});

describe('splitting a sense', () => {
  it('gives the key to the closer half and mints for the other', () => {
    const outcome = resolve(BUILD_1, [
      sense(['bank (financial institution)']),
      sense(['bench']),
      sense(['bench (sports substitutes seating)']),
      sense(['pew']),
    ]);

    expect(blockingFailures(outcome)).toEqual([]);
    const keys = outcome.assignments
      .filter((a) => a.sense.glosses[0]!.startsWith('bench'))
      .map((a) => a.key);

    expect(keys).toContain('es:banco:noun:2');
    expect(new Set(keys).size).toBe(2);
    expect(keys).toContain('es:banco:noun:4');
  });
});

describe('one registry, many languages', () => {
  it('does not orphan another language when building this one', () => {
    // The registry is shared; builds are per language. Without scoping, a
    // Spanish build declares every Vietnamese key orphaned and refuses to run —
    // which is exactly what happened on the first real two-language build.
    const shared = applyOutcome(
      BUILD_1,
      resolve(BUILD_1, [
        sense(['bank (financial institution)']),
        sense(['bench']),
        sense(['pew']),
        { language: 'vi', term: 'bàn', partOfSpeech: 'noun', glosses: ['table'] },
      ]),
    );

    const spanishOnly = resolve(shared, [
      sense(['bank (financial institution)']),
      sense(['bench']),
      sense(['pew']),
    ]);

    expect(blockingFailures(spanishOnly)).toEqual([]);
    expect(spanishOnly.churn.orphaned).toEqual([]);
  });
});

describe('ordinals are never recycled', () => {
  it('continues past the highest ever issued, even after an orphan', () => {
    // pew (:3) leaves with churn allowed, then a new sense arrives. It must get
    // :4 and never :3, or it would inherit a stranger's progress.
    const withoutPew = resolve(BUILD_1, [
      sense(['bank (financial institution)']),
      sense(['bench']),
    ]);
    expect(blockingFailures(withoutPew, true)).toEqual([]);

    const afterOrphan = applyOutcome(BUILD_1, withoutPew);
    expect(afterOrphan.records.map((r) => r.key)).toContain('es:banco:noun:3');

    const next = resolve(afterOrphan, [
      sense(['bank (financial institution)']),
      sense(['bench']),
      sense(['sandbar']),
    ]);
    const sandbar = next.assignments.find((a) => a.sense.glosses[0] === 'sandbar');
    expect(sandbar?.key).toBe('es:banco:noun:4');
  });
});

describe('pruning before release', () => {
  it('keeps only the keys the live packs use', () => {
    const pruned = pruneRegistry(BUILD_1, new Set(['es:banco:noun:1', 'es:banco:noun:2']));
    expect(pruned.registry.records.map((r) => r.key)).toEqual([
      'es:banco:noun:1',
      'es:banco:noun:2',
    ]);
    expect(pruned.removed).toEqual(['es:banco:noun:3']);
  });

  it('stamps prunedAt, and a rebuild does not erase it', () => {
    // That stamp is the only evidence the registry is no longer a complete
    // history, which is what a later reader needs before trusting that a
    // retired ordinal was never reissued.
    const pruned = pruneRegistry(BUILD_1, new Set(['es:banco:noun:1'])).registry;
    expect(pruned.prunedAt).toBeTruthy();

    const after = applyOutcome(pruned, resolve(pruned, [sense(['bank (financial institution)'])]));
    expect(after.prunedAt).toBe(pruned.prunedAt);
  });
});

describe('the registry file itself', () => {
  it('refreshes glosses on a match so slow rewording cannot drift a sense away', () => {
    const outcome = resolve(BUILD_1, [
      sense(['a financial institution']),
      sense(['bench']),
      sense(['pew']),
    ]);
    const next = applyOutcome(BUILD_1, outcome);

    const record = next.records.find((r) => r.key === 'es:banco:noun:1');
    expect(record?.glosses).toEqual(['a financial institution']);
    expect(next.records).toHaveLength(3);
  });

  it('retains an orphaned record so the word can come back to its own key', () => {
    const outcome = resolve(BUILD_1, [
      sense(['bank (financial institution)']),
      sense(['bench']),
    ]);
    const next = applyOutcome(BUILD_1, outcome);

    expect(next.records.find((r) => r.key === 'es:banco:noun:3')).toBeDefined();
  });
});

describe('gloss similarity', () => {
  it('scores a rewording well above an unrelated sense', () => {
    const bank = glossTokens(['bank (financial institution)']);
    const reworded = glossTokens(['a financial institution']);
    const bench = glossTokens(['bench']);

    expect(similarity(bank, reworded)).toBeGreaterThan(similarity(bank, bench));
    expect(similarity(bank, bench)).toBe(0);
  });

  it('needs containment, not similarity, to see a merge swallow a short gloss', () => {
    // Why the two metrics exist. Jaccard scores this pair 0.2 purely on the
    // size mismatch and the merge slips through; containment scores it 1.0.
    const merged = glossTokens(['bank bench (financial institution seat)']);
    const bench = glossTokens(['bench']);

    expect(similarity(merged, bench)).toBeLessThan(MATCH_THRESHOLD);
    expect(containment(merged, bench)).toBe(1);
  });
});
