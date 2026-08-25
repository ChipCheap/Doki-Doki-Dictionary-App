import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PackSchemaError, PackShapeError, type CorePack, type MeaningPack } from './pack-format';
import { mergePack } from './pack-loader';

const packDir = resolve(process.cwd(), 'public/packs');

const load = <T>(file: string): T =>
  JSON.parse(readFileSync(resolve(packDir, file), 'utf8')) as T;

const esCore = () => load<CorePack>('es-core.json');
const esMeaning = () => load<MeaningPack>('es-meaning-en.json');
const viCore = () => load<CorePack>('vi-core.json');
const viMeaning = () => load<MeaningPack>('vi-meaning-en.json');

/**
 * These run against the REAL generated packs, not fixtures.
 *
 * They assert the properties the study loop depends on rather than specific
 * words, because the content changes with every source refresh while the
 * properties must not. A pack that stops satisfying one of these would break
 * the app quietly, so this doubles as the acceptance check on a rebuild.
 */
describe('the shipped packs merge', () => {
  it('merges cleanly, with a meaning for every entry', () => {
    for (const [core, meaning] of [[esCore(), esMeaning()], [viCore(), viMeaning()]] as const) {
      const report = mergePack(core, meaning);
      expect(report.entries.length).toBeGreaterThan(1000);
      expect(report.withoutMeaning).toEqual([]);
      expect(report.skipped).toEqual([]);
    }
  });

  it('attaches each translation to its own example', () => {
    const withExamples = mergePack(esCore(), esMeaning()).entries.filter((e) =>
      e.examples.some((x) => x.translation),
    );
    expect(withExamples.length).toBeGreaterThan(100);

    for (const entry of withExamples.slice(0, 50)) {
      for (const example of entry.examples) {
        expect(example.text.length).toBeGreaterThan(0);
        if (example.translation) expect(example.translation).not.toBe(example.text);
      }
    }
  });

  it('carries a source on every example, so attribution is possible', () => {
    // Always-5: the licences are attribution-bearing, and an example with no
    // source cannot satisfy them.
    const entries = mergePack(esCore(), esMeaning()).entries;
    for (const entry of entries.slice(0, 500)) {
      for (const example of entry.examples) {
        expect(example.source).toBeTruthy();
      }
    }
  });
});

describe('the shipped packs exercise the hard paths', () => {
  it('contains homographs sharing a term and part of speech', () => {
    // Distractor selection must exclude a sibling sense, or a user is marked
    // wrong for knowing the word.
    const entries = mergePack(esCore(), esMeaning()).entries;
    const byTermPos = new Map<string, number>();
    for (const entry of entries) {
      const k = `${entry.term}:${entry.partOfSpeech}`;
      byTermPos.set(k, (byTermPos.get(k) ?? 0) + 1);
    }
    expect([...byTermPos.values()].filter((n) => n > 1).length).toBeGreaterThan(100);
  });

  it('never exceeds three senses for one term and part of speech', () => {
    const entries = mergePack(esCore(), esMeaning()).entries;
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const k = `${entry.term}:${entry.partOfSpeech}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
  });

  it('contains an accent-only minimal pair', () => {
    const terms = mergePack(esCore(), esMeaning()).entries.map((e) => e.term);
    expect(terms).toContain('sí');
    expect(terms).toContain('si');
  });

  it('tags numbers as a sequence so quick-create can exclude them', () => {
    const entries = mergePack(esCore(), esMeaning()).entries;
    const sequenced = entries.filter((e) => e.sequence);
    expect(sequenced.length).toBeGreaterThan(10);
    expect(entries.find((e) => e.term === 'cero')?.sequence).toEqual({
      group: 'number',
      ordinal: 0,
    });
  });

  it('sources gender, and overrides the article where gender would mislead', () => {
    const entries = mergePack(esCore(), esMeaning()).entries;
    expect(entries.filter((e) => e.gender).length).toBeGreaterThan(1000);

    // `el área` is feminine but takes `el`; deriving from gender alone would
    // mark a correct answer wrong.
    const area = entries.find((e) => e.term === 'área');
    expect(area?.gender).toBe('f');
    expect(area?.article).toBe('el');
  });

  it('ships entries with no examples rather than dropping them', () => {
    // Never-6: a word is never dropped for having too few examples.
    const entries = mergePack(esCore(), esMeaning()).entries;
    expect(entries.filter((e) => e.examples.length === 0).length).toBeGreaterThan(0);
  });

  it('spans several difficulty tiers so weighted sampling has something to do', () => {
    const tiers = new Set(mergePack(esCore(), esMeaning()).entries.map((e) => e.difficulty));
    expect(tiers.size).toBeGreaterThanOrEqual(3);
  });

  it('carries stacked Vietnamese diacritics intact', () => {
    const terms = mergePack(viCore(), viMeaning()).entries.map((e) => e.term);
    expect(terms.some((t) => /[ệảộứẩ]/.test(t))).toBe(true);
  });
});

describe('the reader tolerates what it does not know', () => {
  it('ignores unknown fields rather than failing', () => {
    // architecture.md guideline 5: a newer pack must never break an older app.
    const core = esCore() as CorePack & { futureField?: string };
    core.futureField = 'added in a later version';
    (core.entries[0] as unknown as Record<string, unknown>).somethingNew = { nested: true };

    expect(() => mergePack(core, esMeaning())).not.toThrow();
    expect(mergePack(core, esMeaning()).entries.length).toBe(esCore().entries.length);
  });

  it('drops an entry with no meaning rather than shipping an unanswerable card', () => {
    const core = esCore();
    const orphan = core.entries[0]!.key;
    const meaning = esMeaning();
    meaning.entries = meaning.entries.filter((e) => e.key !== orphan);

    const report = mergePack(core, meaning);
    expect(report.withoutMeaning).toEqual([orphan]);
    expect(report.entries).toHaveLength(core.entries.length - 1);
  });

  it('drops a malformed entry and says why', () => {
    const core = esCore();
    core.entries.push({ key: 'es:broken:noun:1' } as never);

    const report = mergePack(core, esMeaning());
    expect(report.skipped).toContainEqual({
      key: 'es:broken:noun:1',
      reason: 'missing term',
    });
  });
});

describe('version and layer guards', () => {
  it('refuses a pack from a newer app, naming the mismatch', () => {
    const core = esCore();
    core.schemaVersion = 99;
    expect(() => mergePack(core, esMeaning())).toThrow(PackSchemaError);
    expect(() => mergePack(core, esMeaning())).toThrow(/version 99/);
  });

  it('refuses to merge layers for different languages', () => {
    expect(() => mergePack(esCore(), viMeaning())).toThrow(PackShapeError);
  });
});
