/**
 * H1 — attribution is a licence obligation, so what needs pinning is not that
 * the screen renders but that no pack can be presented without its sources.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database';
import { installPack, listInstalledPacks } from './install';
import { listAttributions, PACK_LICENCE } from './queries';
import type { CorePack, MeaningPack } from './pack-format';

const SOURCES = [
  {
    name: 'English Wiktionary, extracted by wiktextract via kaikki.org',
    licence: 'CC BY-SA 4.0 (and GFDL)',
    url: 'https://kaikki.org/',
  },
  { name: 'Tatoeba Project', licence: 'CC BY 2.0 FR', url: 'https://tatoeba.org/a' },
  { name: 'Tatoeba Project', licence: 'CC BY 2.0 FR', url: 'https://tatoeba.org/b' },
  { name: 'Tatoeba Project', licence: 'CC BY 2.0 FR', url: 'https://tatoeba.org/c' },
  { name: 'hermitdave/FrequencyWords', licence: 'CC BY-SA 4.0', url: 'https://example.org' },
];

function core(overrides: Partial<CorePack> = {}): CorePack {
  return {
    schemaVersion: 1,
    packVersion: '2026-08-25',
    language: 'es',
    languageName: 'Spanish',
    entries: [
      {
        key: 'es:casa:noun:1',
        term: 'casa',
        partOfSpeech: 'noun',
        difficulty: 'basic',
        contextTags: [],
        examples: [],
      },
    ],
    sources: SOURCES,
    ...overrides,
  };
}

function meaning(): MeaningPack {
  return {
    schemaVersion: 1,
    packVersion: '2026-08-25',
    language: 'es',
    baseLanguage: 'en',
    entries: [{ key: 'es:casa:noun:1', meanings: ['house'] }],
  };
}

beforeEach(async () => {
  await db.open();
  await Promise.all([db.entries.clear(), db.packs.clear()]);
});

describe('installing a pack records where its data came from', () => {
  it('persists the sources, so attribution survives with no network', async () => {
    await installPack(core(), meaning());
    const pack = await db.packs.get('es');
    expect(pack?.sources).toHaveLength(SOURCES.length);
  });

  it('lists one entry per source, collapsing files from the same project', async () => {
    // Tatoeba supplies three files; three identical credits would read as three
    // separate obligations.
    await installPack(core(), meaning());
    const attributions = await listAttributions();

    expect(attributions).toHaveLength(1);
    expect(attributions[0]!.languageName).toBe('Spanish');
    expect(attributions[0]!.sources).toHaveLength(3);
    expect(attributions[0]!.sources.filter((s) => s.name === 'Tatoeba Project')).toHaveLength(1);
  });

  it('carries a licence for every source it lists', async () => {
    await installPack(core(), meaning());
    const [attribution] = await listAttributions();
    for (const source of attribution!.sources) {
      expect(source.licence.length).toBeGreaterThan(0);
    }
  });

  it('states the pack licence as share-alike', () => {
    // The sources carry share-alike terms, so the derived pack inherits them.
    expect(PACK_LICENCE).toContain('BY-SA');
  });
});

describe('a pack with no recorded sources is never presented as attributed', () => {
  it('is excluded from the installed list once its ready flag is cleared', async () => {
    // What the version 4 upgrade does to a pack installed before sources were
    // recorded. Showing that language without attribution would be the same
    // licence failure as having no screen at all.
    await installPack(core(), meaning());
    await db.packs.update('es', { sources: undefined, ready: false });

    expect(await listInstalledPacks()).toEqual([]);
    expect(await listAttributions()).toEqual([]);
  });

  it('reappears, attributed, once reinstalled', async () => {
    await installPack(core(), meaning());
    await db.packs.update('es', { sources: undefined, ready: false });
    await installPack(core(), meaning());

    const attributions = await listAttributions();
    expect(attributions).toHaveLength(1);
    expect(attributions[0]!.sources.length).toBeGreaterThan(0);
  });
});
