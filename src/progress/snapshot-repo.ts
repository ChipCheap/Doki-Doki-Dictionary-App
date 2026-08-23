/**
 * S4 — snapshots and the restore swap.
 *
 * maintenance.framework.md: a snapshot is taken automatically before every
 * mass-edit, and restore is a SWAP rather than a rollback. Loading a snapshot
 * writes the current state into a snapshot and consumes the one being loaded, in
 * the same transaction — so the list goes 5 -> 4 -> 5 and the user can toggle
 * back and forth while deciding whether they like the change.
 *
 * That symmetry is the entire safety story for mass-edit, so nothing here may
 * fail quietly (architecture.md guideline 9).
 */

import { db } from '../database';
import { toDayNumber } from '../domain/ladder';
import { bumpRevisionInTransaction } from './progress-repo';
import type { SnapshotRow } from './schema';

/**
 * How many snapshots are kept. Five, because progress is two integers per
 * (word, vector) and insurance this cheap is not worth rationing.
 */
export const SNAPSHOT_RETENTION = 5;

/** Metadata only — the payload is never carried into the UI. */
export interface SnapshotSummary {
  id: string;
  takenOn: number;
  comment: string;
}

function newId(): string {
  return `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function summaryOf(row: SnapshotRow): SnapshotSummary {
  return { id: row.id, takenOn: row.takenOn, comment: row.comment };
}

const SWAP_BACK = /^State before restoring "(.*)"$/s;

/**
 * Name the state a restore leaves behind.
 *
 * The naming TOGGLES rather than nesting, because a swap is symmetric and the
 * names have to be too. Restoring "Equalize recognition" leaves behind
 * `State before restoring "Equalize recognition"`; restoring THAT leaves behind
 * the original "Equalize recognition" again, because the state being set aside
 * is once more exactly what that snapshot held.
 *
 * Wrapping unconditionally would both mislead — the set-aside state is the
 * original, not a "before" of anything — and grow a level deeper on every
 * toggle until the list was unreadable.
 */
export function swapBackComment(loadedComment: string): string {
  return SWAP_BACK.exec(loadedComment)?.[1] ?? `State before restoring "${loadedComment}"`;
}

/** Newest first — the one a user wants is almost always the last one taken. */
export async function listSnapshots(): Promise<SnapshotSummary[]> {
  const rows = await db.snapshots.toArray();
  return rows.sort((a, b) => b.takenOn - a.takenOn || b.id.localeCompare(a.id)).map(summaryOf);
}

async function capture(): Promise<SnapshotRow['payload']> {
  return {
    progress: await db.progress.toArray(),
    words: await db.words.toArray(),
    decks: await db.decks.toArray(),
  };
}

/**
 * Drop the oldest beyond the retention limit.
 *
 * Called inside the caller's transaction so a take is never left over its limit
 * even briefly.
 */
async function pruneInTransaction(): Promise<void> {
  const rows = await db.snapshots.toArray();
  if (rows.length <= SNAPSHOT_RETENTION) return;

  const doomed = rows
    .sort((a, b) => a.takenOn - b.takenOn || a.id.localeCompare(b.id))
    .slice(0, rows.length - SNAPSHOT_RETENTION);

  await db.snapshots.bulkDelete(doomed.map((r) => r.id));
}

/**
 * Take a snapshot inside a transaction the caller already opened.
 *
 * `applyMassEdit` needs this: the snapshot and the edit must commit or fail
 * together, or a failure could leave an orphan snapshot describing a state that
 * was never reached.
 */
export async function takeSnapshotInTransaction(comment: string): Promise<SnapshotRow> {
  const row: SnapshotRow = {
    id: newId(),
    takenOn: toDayNumber(),
    comment,
    payload: await capture(),
  };

  await db.snapshots.put(row);
  await pruneInTransaction();
  return row;
}

export async function takeSnapshot(comment: string): Promise<SnapshotSummary> {
  const row = await db.transaction(
    'rw',
    db.snapshots,
    db.progress,
    db.words,
    db.decks,
    db.settings,
    async () => {
      const taken = await takeSnapshotInTransaction(comment);
      await bumpRevisionInTransaction();
      return taken;
    },
  );
  return summaryOf(row);
}

export async function deleteSnapshot(id: string): Promise<void> {
  await db.snapshots.delete(id);
}

export interface RestoreCounts {
  words: number;
  vectorStates: number;
  decks: number;
}

/**
 * Restore a snapshot by swapping it with the current state.
 *
 * Four moves, one transaction:
 *   1. capture the current state C
 *   2. delete the snapshot S being loaded
 *   3. insert C as a new snapshot, naming what it is
 *   4. replace progress, words and decks from S's payload
 *
 * Step 3 commits before the user can act again, which is what makes restoring
 * twice always available: the entry consumed in step 2 is replaced by one
 * holding exactly what was just left, so restoring C reverses the reversal. The
 * list never loses a slot — its contents trade places with live data.
 *
 * This is a FULL RELOAD, not a targeted undo: everything since the snapshot is
 * discarded, study included. The UI must say so before calling this.
 */
export async function restoreSnapshot(id: string): Promise<RestoreCounts> {
  return db.transaction(
    'rw',
    db.snapshots,
    db.progress,
    db.words,
    db.decks,
    db.settings,
    async () => {
      const loading = await db.snapshots.get(id);
      if (!loading) {
        throw new Error('That snapshot is no longer there. Nothing was changed.');
      }

      const current = await capture();

      await db.snapshots.delete(id);
      await db.snapshots.put({
        id: newId(),
        takenOn: toDayNumber(),
        comment: swapBackComment(loading.comment),
        payload: current,
      });

      await db.progress.clear();
      await db.words.clear();
      await db.decks.clear();

      if (loading.payload.progress.length > 0) await db.progress.bulkPut(loading.payload.progress);
      if (loading.payload.words.length > 0) await db.words.bulkPut(loading.payload.words);
      if (loading.payload.decks.length > 0) await db.decks.bulkPut(loading.payload.decks);

      await bumpRevisionInTransaction();

      return {
        words: loading.payload.words.length,
        vectorStates: loading.payload.progress.length,
        decks: loading.payload.decks.length,
      };
    },
  );
}
