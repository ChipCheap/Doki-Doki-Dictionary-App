import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PackSchemaError, PackShapeError, type CorePack, type MeaningPack } from './pack-format';
import { mergePack } from './pack-loader';

const packDir = resolve(process.cwd(), 'public/packs');

const load = <T>(file: string): T =>
  JSON.parse(readFileSync(resolve(packDir, file), 'utf8')) as T;

const esCore = () => load<CorePack>('es-core.seed.json');
const esMeaning = () => load<MeaningPack>('es-meaning-en.seed.json');
const viCore = () => load<CorePack>('vi-core.seed.json');
const viMeaning = () => load<MeaningPack>('vi-meaning-en.seed.json');

describe('the seed packs merge', () => {
  it('produces twenty usable Spanish entries', () => {
    const report = mergePack(esCore(), esMeaning());
    expect(report.entries).toHaveLength(20);
    expect(report.withoutMeaning).toEqual([]);
    expect(report.skipped).toEqual([]);
  });

  it('produces twenty usable Vietnamese entries', () => {
    const report = mergePack(viCore(), viMeaning());
    expect(report.entries).toHaveLength(20);
    expect(report.withoutMeaning).toEqual([]);
    expect(report.skipped).toEqual([]);
  });

  it('attaches translations to the right examples', () => {
    const entry = mergePack(viCore(), viMeaning()).entries.find(
      (e) => e.key === 'vi:bệnh viện:noun:1',
    );
    expect(entry?.examples[0]?.text).toBe('Tôi phải đến bệnh viện.');
    expect(entry?.examples[0]?.translation).toBe('I have to go to the hospital.');
  });
});

describe('the seed packs exercise the hard paths', () => {
  it('contains a homograph pair sharing a term and part of speech', () => {
    // `banco` is a noun meaning both bank and bench. Distractor selection must
    // exclude the sibling, or a user is marked wrong for knowing the word.
    const entries = mergePack(esCore(), esMeaning()).entries;
    const banco = entries.filter((e) => e.term === 'banco' && e.partOfSpeech === 'noun');
    expect(banco).toHaveLength(2);
    expect(banco.flatMap((b) => b.meanings).sort()).toEqual(['bank', 'bench']);
  });

  it('contains two entries sharing a meaning, to fire the rejection check', () => {
    const entries = mergePack(esCore(), esMeaning()).entries;
    const leavers = entries.filter(
      (e) => e.partOfSpeech === 'verb' && e.meanings.includes('to leave'),
    );
    expect(leavers.map((e) => e.term).sort()).toEqual(['dejar', 'salir']);
  });

  it('contains an accent-only minimal pair', () => {
    const terms = mergePack(esCore(), esMeaning()).entries.map((e) => e.term);
    expect(terms).toContain('sí');
    expect(terms).toContain('si');
  });

  it('contains a sequence-tagged number for quick-create to exclude', () => {
    const entries = mergePack(esCore(), esMeaning()).entries;
    const tres = entries.find((e) => e.key === 'es:tres:numeral:1');
    expect(tres?.sequence).toEqual({ group: 'number', ordinal: 3 });
  });

  it('contains stacked Vietnamese diacritics', () => {
    const terms = mergePack(viCore(), viMeaning()).entries.map((e) => e.term);
    expect(terms).toContain('phản bội');
    expect(terms).toContain('bệnh viện');
  });

  it('contains entries with only one example, and reports them', () => {
    // Two preferred, fewer accepted — a word is never dropped for thin examples.
    const report = mergePack(esCore(), esMeaning());
    expect(report.thinExamples).toBeGreaterThan(0);
    expect(report.entries.every((e) => e.examples.length >= 1)).toBe(true);
  });

  it('spans several difficulty tiers so weighted sampling has something to do', () => {
    const tiers = new Set(mergePack(esCore(), esMeaning()).entries.map((e) => e.difficulty));
    expect(tiers.size).toBeGreaterThanOrEqual(3);
  });
});

describe('the reader tolerates what it does not know', () => {
  it('ignores unknown fields rather than failing', () => {
    // architecture.md guideline 5: a newer pack must never break an older app.
    const core = esCore() as CorePack & { futureField?: string };
    core.futureField = 'added in a later version';
    (core.entries[0] as unknown as Record<string, unknown>).somethingNew = { nested: true };

    expect(() => mergePack(core, esMeaning())).not.toThrow();
    expect(mergePack(core, esMeaning()).entries).toHaveLength(20);
  });

  it('drops an entry with no meaning rather than shipping an unanswerable card', () => {
    const meaning = esMeaning();
    meaning.entries = meaning.entries.filter((e) => e.key !== 'es:casa:noun:1');

    const report = mergePack(esCore(), meaning);
    expect(report.withoutMeaning).toEqual(['es:casa:noun:1']);
    expect(report.entries).toHaveLength(19);
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
