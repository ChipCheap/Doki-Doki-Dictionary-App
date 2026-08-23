/**
 * H2 — the two properties everything else rests on: a mass-edit is atomic, and
 * a restore is a reversible swap. Neither is visible by reading the code, and
 * both are what stand between a mis-aimed mass-edit and months of lost work.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database';
import { planMassEdit } from '../domain/maintenance';
import { applyMassEdit, getWordProgress } from './progress-repo';
import {
  deleteSnapshot,
  listSnapshots,
  restoreSnapshot,
  swapBackComment,
  takeSnapshot,
  SNAPSHOT_RETENTION,
} from './snapshot-repo';
import type { DeckRow, ProgressRow } from './schema';

const VECTORS = ['recognition', 'production'];
const TODAY = 20_000;

function deck(id = 'deck_1', memberKeys: string[] = ['a', 'b']): DeckRow {
  return {
    id,
    language: 'es',
    name: 'Test deck',
    tags: [],
    memberKeys,
    recipe: { difficulties: [], contextTags: [], includeSequence: false },
    createdOn: TODAY,
  };
}

async function seed(): Promise<void> {
  await db.progress.bulkPut([
    { wordKey: 'a', vectorId: 'recognition', level: 3, dueDay: 20_100 },
    { wordKey: 'a', vectorId: 'production', level: 3, dueDay: 20_100 },
  ]);
  await db.words.bulkPut([{ key: 'a', introducedOn: 19_000 }]);
  await db.decks.put(deck());
}

async function rows(): Promise<ProgressRow[]> {
  return (await db.progress.toArray()).sort(
    (x, y) => x.wordKey.localeCompare(y.wordKey) || x.vectorId.localeCompare(y.vectorId),
  );
}

function planFor(level: number, keys = ['a', 'b']) {
  return planMassEdit({
    words: keys.map((key) => ({ key, term: key, partOfSpeech: 'noun' })),
    progress: new Map(),
    operation: { kind: 'setLevel', level },
    enabledVectors: VECTORS,
    today: TODAY,
    rate: 10,
  });
}

beforeEach(async () => {
  await db.open();
  await Promise.all([
    db.progress.clear(),
    db.words.clear(),
    db.decks.clear(),
    db.snapshots.clear(),
    db.settings.clear(),
  ]);
});

describe('the database', () => {
  it('declares the snapshot store added in version 3', () => {
    expect(db.tables.map((t) => t.name)).toContain('snapshots');
  });
});

describe('snapshots', () => {
  it('captures progress, words and decks — but not settings', async () => {
    await seed();
    await db.settings.put({ key: 'globalSettings', value: { textScale: 1.4 } });

    await takeSnapshot('before');
    const stored = await db.snapshots.toArray();

    expect(stored).toHaveLength(1);
    expect(stored[0]!.payload.progress).toHaveLength(2);
    expect(stored[0]!.payload.decks).toHaveLength(1);
    // A mass-edit never changes settings, so its undo must not revert them.
    expect(stored[0]!.payload).not.toHaveProperty('settings');
  });

  it('keeps only the newest five', async () => {
    for (let i = 0; i < SNAPSHOT_RETENTION + 3; i += 1) {
      await takeSnapshot(`edit ${i}`);
    }

    const kept = await listSnapshots();
    expect(kept).toHaveLength(SNAPSHOT_RETENTION);
    expect(kept.map((s) => s.comment)).toContain('edit 7');
    expect(kept.map((s) => s.comment)).not.toContain('edit 0');
  });

  it('deletes on request', async () => {
    const taken = await takeSnapshot('doomed');
    await deleteSnapshot(taken.id);
    expect(await listSnapshots()).toHaveLength(0);
  });
});

describe('restore is a symmetric swap', () => {
  it('returns to the starting state when restored twice', async () => {
    await seed();
    const before = await rows();

    await applyMassEdit(planFor(7), 'set everything to 7', TODAY);
    const after = await rows();
    expect(after).not.toEqual(before);

    const snapshot = (await listSnapshots())[0]!;
    await restoreSnapshot(snapshot.id);
    expect(await rows()).toEqual(before);

    const swapBack = (await listSnapshots())[0]!;
    await restoreSnapshot(swapBack.id);
    expect(await rows()).toEqual(after);
  });

  it('leaves the snapshot count unchanged — the swap is net zero', async () => {
    await seed();
    await applyMassEdit(planFor(7), 'set everything to 7', TODAY);

    const before = await listSnapshots();
    await restoreSnapshot(before[0]!.id);
    expect(await listSnapshots()).toHaveLength(before.length);
  });

  it('toggles the swap-back name rather than nesting it', async () => {
    await seed();
    await applyMassEdit(planFor(7), 'Equalize recognition', TODAY);

    await restoreSnapshot((await listSnapshots())[0]!.id);
    expect((await listSnapshots())[0]!.comment).toBe(
      'State before restoring "Equalize recognition"',
    );

    // Restoring the swap-back sets aside exactly what the original held, so it
    // gets the original name back rather than another layer of wrapping.
    await restoreSnapshot((await listSnapshots())[0]!.id);
    expect((await listSnapshots())[0]!.comment).toBe('Equalize recognition');
  });

  it('is a pure function on the name', () => {
    const once = swapBackComment('Equalize recognition');
    expect(once).toBe('State before restoring "Equalize recognition"');
    expect(swapBackComment(once)).toBe('Equalize recognition');
  });

  it('refuses a snapshot that is no longer there', async () => {
    await expect(restoreSnapshot('snap_missing')).rejects.toThrow(/no longer there/);
  });
});

describe('mass-edit atomicity', () => {
  it('leaves neither a partial write nor an orphan snapshot when it fails', async () => {
    await seed();
    const before = await rows();

    // A deck operation naming a deck that does not exist fails AFTER the
    // snapshot has been written inside the transaction — exactly the ordering
    // that would strand an orphan if the two were merely sequential.
    const plan = planMassEdit({
      words: [{ key: 'a', term: 'a', partOfSpeech: 'noun' }],
      progress: new Map(),
      operation: { kind: 'deckMembership', action: 'add', deckId: 'deck_missing' },
      enabledVectors: VECTORS,
      today: TODAY,
      rate: 10,
    });

    await expect(applyMassEdit(plan, 'doomed edit', TODAY)).rejects.toThrow(
      /deck no longer exists/,
    );

    expect(await rows()).toEqual(before);
    expect(await listSnapshots()).toHaveLength(0);
  });

  it('refuses an empty selection before anything is written', async () => {
    await expect(applyMassEdit(planFor(5, []), 'nothing', TODAY)).rejects.toThrow(
      /nothing to change/,
    );
    expect(await listSnapshots()).toHaveLength(0);
  });

  it('refuses a blank comment', async () => {
    await expect(applyMassEdit(planFor(5), '   ', TODAY)).rejects.toThrow(/needs a comment/);
    expect(await listSnapshots()).toHaveLength(0);
  });

  it('writes exactly one snapshot per committed edit', async () => {
    await seed();
    await applyMassEdit(planFor(6), 'first', TODAY);
    await applyMassEdit(planFor(7), 'second', TODAY);

    expect((await listSnapshots()).map((s) => s.comment)).toEqual(['second', 'first']);
  });
});

describe('mass-edit effects', () => {
  it('marks never-studied words introduced so they are served as reviews', async () => {
    await seed();
    await applyMassEdit(planFor(5), 'claim these as known', TODAY);

    const words = await db.words.toArray();
    expect(words.find((w) => w.key === 'b')?.introducedOn).toBe(TODAY);
    // An already-introduced word keeps its original day.
    expect(words.find((w) => w.key === 'a')?.introducedOn).toBe(19_000);
  });

  it('preserves progress when a word is removed from its only deck', async () => {
    await seed();
    const before = await getWordProgress(['a']);

    const plan = planMassEdit({
      words: [{ key: 'a', term: 'a', partOfSpeech: 'noun' }],
      progress: new Map(),
      operation: { kind: 'deckMembership', action: 'remove', deckId: 'deck_1' },
      enabledVectors: VECTORS,
      today: TODAY,
      rate: 10,
    });
    await applyMassEdit(plan, 'retire from the deck', TODAY);

    expect((await db.decks.get('deck_1'))!.memberKeys).not.toContain('a');
    expect(await getWordProgress(['a'])).toEqual(before);
  });
});
