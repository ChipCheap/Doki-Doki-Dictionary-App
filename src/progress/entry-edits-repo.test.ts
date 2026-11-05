/**
 * Corrections are user data: they must survive an export and import, and an
 * export made before they existed must still import.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database';
import type { EntryEdits } from '../domain/entry-edits';
import { listEntryEdits, saveEntryEdits } from './entry-edits-repo';
import { exportProfile, importProfile, parseProfile } from './transfer';

const EDITS: EntryEdits = {
  wordKey: 'vi:anh:pron:1',
  meanings: { 'I/me, a male who is slightly older than you': { text: 'I/me (older male)' } },
  examples: { 'wikt:abc': { removed: 'deleted' } },
};

beforeEach(async () => {
  await db.open();
  await Promise.all([
    db.progress.clear(),
    db.words.clear(),
    db.decks.clear(),
    db.entryEdits.clear(),
    db.settings.clear(),
  ]);
});

describe('saveEntryEdits', () => {
  it('stores a word’s corrections', async () => {
    await saveEntryEdits(EDITS);
    expect((await listEntryEdits()).get(EDITS.wordKey)).toEqual(EDITS);
  });

  it('removes the row once nothing is corrected', async () => {
    await saveEntryEdits(EDITS);
    await saveEntryEdits({ wordKey: EDITS.wordKey, meanings: {}, examples: {} });
    expect((await listEntryEdits()).size).toBe(0);
  });
});

describe('profile transfer', () => {
  it('carries corrections through an export and import', async () => {
    await saveEntryEdits(EDITS);
    const exported = parseProfile(JSON.parse(JSON.stringify(await exportProfile())));

    await db.entryEdits.clear();
    const counts = await importProfile(exported);

    expect(counts.corrections).toBe(1);
    expect((await listEntryEdits()).get(EDITS.wordKey)).toEqual(EDITS);
  });

  it('imports an export from before corrections existed, replacing local ones', async () => {
    await saveEntryEdits(EDITS);
    const older = { schemaVersion: 1, progress: [], words: [], decks: [] };

    await importProfile(parseProfile(older));

    expect((await listEntryEdits()).size).toBe(0);
  });

  it('drops a malformed correction row rather than failing the import', () => {
    const profile = parseProfile({
      schemaVersion: 1,
      progress: [],
      words: [],
      decks: [],
      entryEdits: [EDITS, { wordKey: 7 }, null],
    });
    expect(profile.entryEdits).toEqual([EDITS]);
  });
});
