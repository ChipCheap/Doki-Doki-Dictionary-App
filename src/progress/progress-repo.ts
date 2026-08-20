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
import type { WordKey, WordProgress } from '../domain/types';
import type { VectorId } from '../domain/vectors';
import type { ProgressRow } from './schema';

const REVISION_KEY = 'profileRevision';

/**
 * Bumped on every mutation. A future sync uses it to tell which device is
 * newer; nothing in v1 reads it, which is fine — it costs one integer and is
 * impossible to reconstruct after the fact.
 */
export async function bumpRevision(): Promise<number> {
  const row = await db.settings.get(REVISION_KEY);
  const next = (typeof row?.value === 'number' ? row.value : 0) + 1;
  await db.settings.put({ key: REVISION_KEY, value: next });
  return next;
}

export async function getRevision(): Promise<number> {
  const row = await db.settings.get(REVISION_KEY);
  return typeof row?.value === 'number' ? row.value : 0;
}

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

/** Same as `bumpRevision`, callable inside an open transaction. */
async function bumpRevisionInTransaction(): Promise<void> {
  const row = await db.settings.get(REVISION_KEY);
  const next = (typeof row?.value === 'number' ? row.value : 0) + 1;
  await db.settings.put({ key: REVISION_KEY, value: next });
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
  await db.transaction('rw', db.progress, db.settings, async () => {
    for (const vectorId of vectorIds) {
      const existing = await db.progress.get([wordKey, vectorId]);
      const dueDay =
        existing?.dueDay ?? dueDayFor(level, today) + staggerOffset;
      await db.progress.put({ wordKey, vectorId, level, dueDay });
    }
    await bumpRevisionInTransaction();
  });
}

export async function setHidden(wordKey: WordKey, hidden: boolean): Promise<void> {
  await db.transaction('rw', db.words, db.settings, async () => {
    const word = await db.words.get(wordKey);
    await db.words.put({ ...(word ?? { key: wordKey }), hidden });
    await bumpRevisionInTransaction();
  });
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
