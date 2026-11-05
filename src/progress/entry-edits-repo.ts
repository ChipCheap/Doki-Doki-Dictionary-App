/**
 * The user's corrections to dictionary entries — reads and writes.
 *
 * The rows are small and few (one per word the user has corrected), so they are
 * read whole: a session or a browse list needs them for words it has not
 * narrowed down yet, such as the distractors of a multiple-choice card.
 */

import { db } from '../database';
import { hasNoEdits, type EntryEdits } from '../domain/entry-edits';
import type { WordKey } from '../domain/types';
import { bumpRevisionInTransaction } from './revision';

export async function listEntryEdits(): Promise<Map<WordKey, EntryEdits>> {
  const rows = await db.entryEdits.toArray();
  return new Map(rows.map((row) => [row.wordKey, row]));
}

/** Store a word's corrections, or remove the row once none are left. */
export async function saveEntryEdits(edits: EntryEdits): Promise<void> {
  await db.transaction('rw', db.entryEdits, db.settings, async () => {
    if (hasNoEdits(edits)) await db.entryEdits.delete(edits.wordKey);
    else await db.entryEdits.put(edits);
    await bumpRevisionInTransaction();
  });
}
