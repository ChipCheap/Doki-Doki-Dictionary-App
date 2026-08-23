/**
 * S13 — the progress repository.
 *
 * The public surface for ALL progress reads and writes: no screen touches
 * storage directly (architecture.md guideline 2). This surface is also the
 * documented attachment point for any future sync — at ~200 KB a whole profile
 * is pushed and pulled entire, so nothing needs designing in advance.
 */

import { db } from '../database';
import type { DayNumber, Level } from '../domain/ladder';
import { dueDayFor } from '../domain/ladder';
import type { MassEditPlan } from '../domain/maintenance';
import type { WordKey, WordProgress } from '../domain/types';
import type { VectorId } from '../domain/vectors';
import { bumpRevision, bumpRevisionInTransaction, getRevision } from './revision';
import type { ProgressRow } from './schema';
import { takeSnapshotInTransaction } from './snapshot-repo';

// Re-exported so existing callers keep importing the revision counter from the
// repository surface rather than reaching past it.
export { bumpRevision, bumpRevisionInTransaction, getRevision };

/** Assemble the domain-shaped view of a set of words. */
export async function getWordProgress(
  keys: readonly WordKey[],
): Promise<Map<WordKey, WordProgress>> {
  const out = new Map<WordKey, WordProgress>();
  if (keys.length === 0) return out;

  const wordRows = await db.words.bulkGet([...keys]);
  const progressRows = await db.progress.where('wordKey').anyOf([...keys]).toArray();

  const byWord = new Map<WordKey, ProgressRow[]>();
  for (const row of progressRows) {
    const list = byWord.get(row.wordKey) ?? [];
    list.push(row);
    byWord.set(row.wordKey, list);
  }

  keys.forEach((key, index) => {
    const word = wordRows[index];
    const vectors: Record<VectorId, { level: Level; dueDay: DayNumber }> = {};
    for (const row of byWord.get(key) ?? []) {
      vectors[row.vectorId] = { level: row.level, dueDay: row.dueDay };
    }
    out.set(key, {
      key,
      ...(word?.introducedOn !== undefined ? { introducedOn: word.introducedOn } : {}),
      ...(word?.hidden ? { hidden: true } : {}),
      vectors,
    });
  });

  return out;
}

/**
 * Just the hidden set.
 *
 * Hiding has to be resolved for every candidate before paging — hidden words are
 * excluded by default, so they change which words land on which page. But
 * `hidden` cannot be indexed (IndexedDB keys may not be booleans), and the
 * `words` table holds one row per word the user has actually touched, which is a
 * fraction of the dictionary. Reading it entire is far cheaper than reading all
 * progress, and is all this particular filter needs.
 */
export async function getHiddenKeys(): Promise<Set<WordKey>> {
  const rows = await db.words.filter((row) => row.hidden === true).toArray();
  return new Set(rows.map((r) => r.key));
}

/**
 * Every word's progress at once, for filtering on level or vector.
 *
 * Reached for only when a progress-side filter is active: those filters have to
 * run BEFORE paging, or the page and the count would both be computed from data
 * that was never read. Otherwise callers page and ask for the visible keys only.
 * Rows exist only for pairs actually studied, so this is bounded by what the
 * user has done rather than by the size of the dictionary.
 */
export async function getAllWordProgress(): Promise<Map<WordKey, WordProgress>> {
  const [progressRows, wordRows] = await Promise.all([
    db.progress.toArray(),
    db.words.toArray(),
  ]);

  const out = new Map<WordKey, WordProgress>();
  const ensure = (key: WordKey): WordProgress => {
    let entry = out.get(key);
    if (!entry) {
      entry = { key, vectors: {} };
      out.set(key, entry);
    }
    return entry;
  };

  for (const row of wordRows) {
    const entry = ensure(row.key);
    if (row.introducedOn !== undefined) entry.introducedOn = row.introducedOn;
    if (row.hidden) entry.hidden = true;
  }

  for (const row of progressRows) {
    const entry = ensure(row.wordKey);
    (entry.vectors as Record<VectorId, { level: Level; dueDay: DayNumber }>)[row.vectorId] = {
      level: row.level,
      dueDay: row.dueDay,
    };
  }

  return out;
}

export interface GradeWrite {
  wordKey: WordKey;
  vectorId: VectorId;
  level: Level;
  dueDay: DayNumber;
  today: DayNumber;
}

/**
 * Write one graded outcome.
 *
 * Committed immediately, with no batching and no end-of-session flush — so
 * closing the tab mid-quiz loses nothing already answered (framework.md).
 * Stamps `introducedOn` the first time a word is quizzed, which is what makes
 * introduction a word-level, deck-independent fact.
 */
export async function recordGrade(write: GradeWrite): Promise<void> {
  await db.transaction('rw', db.progress, db.words, db.settings, async () => {
    await db.progress.put({
      wordKey: write.wordKey,
      vectorId: write.vectorId,
      level: write.level,
      dueDay: write.dueDay,
    });

    const word = await db.words.get(write.wordKey);
    if (word?.introducedOn === undefined) {
      await db.words.put({ ...(word ?? { key: write.wordKey }), introducedOn: write.today });
    }

    await bumpRevisionInTransaction();
  });
}

/**
 * Set a level manually.
 *
 * maintenance.framework.md: this writes EVERY vector of the word, downward
 * moves included. The discrepancy between vectors is mostly an artifact of
 * which one came up more often, not a real difference in knowledge.
 *
 * An existing due day is left untouched — the word arrives when it was already
 * scheduled and rejoins its proper cadence after one answer. A vector with no
 * due day yet gets one, staggered, so setting a thousand words to level 7 does
 * not make a thousand reviews fall due at once.
 */
export async function setLevelForAllVectors(
  wordKey: WordKey,
  level: Level,
  vectorIds: readonly VectorId[],
  today: DayNumber,
  staggerOffset = 0,
): Promise<void> {
  await db.transaction('rw', db.progress, db.words, db.settings, async () => {
    for (const vectorId of vectorIds) {
      const existing = await db.progress.get([wordKey, vectorId]);
      const dueDay =
        existing?.dueDay ?? dueDayFor(level, today) + staggerOffset;
      await db.progress.put({ wordKey, vectorId, level, dueDay });
    }

    // Asserting a level is asserting the word is already known, so it belongs
    // on the review schedule rather than in the introduction queue. Without
    // this, `session.ts` still classifies it as new vocabulary — it decides
    // new-versus-review on `introducedOn`, NOT on level — and the level just
    // written would never be used.
    const word = await db.words.get(wordKey);
    if (word?.introducedOn === undefined) {
      await db.words.put({ ...(word ?? { key: wordKey }), introducedOn: today });
    }

    await bumpRevisionInTransaction();
  });
}

/** Bulk hide/unhide, for the mass-edit path. Word-wide, never per vector. */
export async function setHiddenMany(
  wordKeys: readonly WordKey[],
  hidden: boolean,
): Promise<void> {
  await db.transaction('rw', db.words, db.settings, async () => {
    await setHiddenManyInTransaction(wordKeys, hidden);
    await bumpRevisionInTransaction();
  });
}

async function setHiddenManyInTransaction(
  wordKeys: readonly WordKey[],
  hidden: boolean,
): Promise<void> {
  const existing = await db.words.bulkGet([...wordKeys]);
  const rows = wordKeys.map((key, i) => ({
    ...(existing[i] ?? { key }),
    hidden,
  }));
  if (rows.length > 0) await db.words.bulkPut(rows);
}

export async function setHidden(wordKey: WordKey, hidden: boolean): Promise<void> {
  await db.transaction('rw', db.words, db.settings, async () => {
    const word = await db.words.get(wordKey);
    await db.words.put({ ...(word ?? { key: wordKey }), hidden });
    await bumpRevisionInTransaction();
  });
}

export interface MassEditResult {
  wordsAffected: number;
  vectorsWritten: number;
  snapshotId: string;
}

/**
 * Apply a mass-edit, and the snapshot that protects it, as ONE transaction.
 *
 * All-or-nothing is the whole point. A partial edit whose snapshot did commit is
 * the worst outcome available here — the user would hold an undo describing a
 * state that never existed — so the two are made inseparable rather than merely
 * ordered. A snapshot that cannot be written aborts the edit, which is the
 * framework's "refused rather than performed unprotected" falling out of the
 * structure instead of needing its own check.
 *
 * The plan arrives already computed (`domain/maintenance.ts`), so what is
 * written here is exactly what the user was shown.
 */
export async function applyMassEdit(
  plan: MassEditPlan,
  comment: string,
  today: DayNumber,
): Promise<MassEditResult> {
  if (plan.wordsAffected === 0) {
    throw new Error('That selection matches no words, so there is nothing to change.');
  }
  if (comment.trim().length === 0) {
    throw new Error('A mass-edit needs a comment — it is what identifies its snapshot later.');
  }

  return db.transaction(
    'rw',
    db.snapshots,
    db.progress,
    db.words,
    db.decks,
    db.settings,
    async () => {
      const snapshot = await takeSnapshotInTransaction(comment.trim());

      if (plan.operation.kind === 'setLevel') {
        await db.progress.bulkPut(
          plan.writes.map((w) => ({
            wordKey: w.wordKey,
            vectorId: w.vectorId,
            level: w.level,
            dueDay: w.dueDay,
          })),
        );

        // Same reason as the single-word path: a level is an assertion that the
        // word is known, and `session.ts` decides new-versus-review on
        // introduction. Without this the whole batch stays queued as new
        // vocabulary and the levels just written go unused.
        if (plan.introduced.length > 0) {
          const existing = await db.words.bulkGet([...plan.introduced]);
          // Re-checked here rather than trusted from the plan. `introducedOn`
          // is load-bearing — it is the new-word budget counter and the due day
          // an un-quizzed vector inherits — so overwriting a real one would
          // quietly rewrite a word's history. The plan is computed against a
          // snapshot of progress taken before the user filled in a comment, and
          // a write this consequential should not depend on that being fresh.
          const stamped = plan.introduced
            .map((key, i) => ({ ...(existing[i] ?? { key }), introducedOn: today }))
            .filter((_, i) => existing[i]?.introducedOn === undefined);

          if (stamped.length > 0) await db.words.bulkPut(stamped);
        }
      } else if (plan.operation.kind === 'setHidden') {
        await setHiddenManyInTransaction(plan.wordKeys, plan.operation.hidden);
      } else {
        await applyDeckMembershipInTransaction(plan);
      }

      await bumpRevisionInTransaction();

      return {
        wordsAffected: plan.wordsAffected,
        vectorsWritten: plan.writes.length,
        snapshotId: snapshot.id,
      };
    },
  );
}

/**
 * Deck membership, inside the mass-edit transaction.
 *
 * Kept here rather than in `deck-repo` because it must join the transaction the
 * snapshot is already part of; `deck-repo` owns the standalone edits.
 */
async function applyDeckMembershipInTransaction(plan: MassEditPlan): Promise<void> {
  if (plan.operation.kind !== 'deckMembership') return;

  const deck = await db.decks.get(plan.operation.deckId);
  if (!deck) {
    throw new Error('That deck no longer exists. Nothing was changed.');
  }

  const members = new Set(deck.memberKeys);
  for (const key of plan.wordKeys) {
    if (plan.operation.action === 'add') members.add(key);
    else members.delete(key);
  }

  await db.decks.put({ ...deck, memberKeys: [...members] });
}

/** Mark a word introduced without grading it — used by *don't study*. */
export async function markIntroduced(wordKey: WordKey, today: DayNumber): Promise<void> {
  const word = await db.words.get(wordKey);
  if (word?.introducedOn !== undefined) return;
  await db.words.put({ ...(word ?? { key: wordKey }), introducedOn: today });
  await bumpRevision();
}

/** Every stored row, for export. */
export async function exportRows(): Promise<{
  progress: ProgressRow[];
  words: Awaited<ReturnType<typeof db.words.toArray>>;
}> {
  return {
    progress: await db.progress.toArray(),
    words: await db.words.toArray(),
  };
}
