/**
 * S1, S2 — selection matching and mass-edit planning.
 *
 * maintenance.framework.md: a mass-edit is a rare corrective tool, and most of
 * its design exists to make it survivable. This module is the survivable part
 * that can be tested without a database — the write set is computed as plain
 * data BEFORE anything touches storage, so the summary the user approves and the
 * rows that get written come from one source and cannot disagree.
 *
 * Two rules from the framework are easy to get backwards and are worth stating
 * up front:
 *  - A VECTOR IS A FILTER, NEVER A SCOPE. Naming a vector narrows which words
 *    are selected; it never narrows which vectors get written. Setting a level
 *    always writes every enabled vector of the word.
 *  - A VECTOR WITH NO STORED ROW IS AT LEVEL 0. Without that, "everything at
 *    0-2" would select nothing at all, which is the framework's headline case.
 */

import {
  NEW_LEVEL,
  intervalForLevel,
  type DayNumber,
  type Level,
} from './ladder';
import type { WordKey, WordProgress } from './types';
import type { VectorId } from './vectors';

/** The three operations. There is deliberately no fourth. */
export type MassEditOperation =
  | { kind: 'setLevel'; level: Level }
  | { kind: 'setHidden'; hidden: boolean }
  | { kind: 'deckMembership'; action: 'add' | 'remove'; deckId: string };

export interface LevelRange {
  min: Level;
  max: Level;
}

/** The progress-side half of a selection. The dictionary resolves the rest. */
export interface ProgressFilter {
  /** Named vector: only this one is consulted. Absent: any vector may match. */
  vectorId?: VectorId;
  levels?: LevelRange;
  includeHidden?: boolean;
}

/** A word as selection needs to see it. The dictionary supplies these. */
export interface SelectableWord {
  key: WordKey;
  term: string;
  partOfSpeech: string;
}

/** The level a vector sits at, treating an absent row as never-studied. */
export function levelOf(
  progress: WordProgress | undefined,
  vectorId: VectorId,
): Level {
  return progress?.vectors[vectorId]?.level ?? NEW_LEVEL;
}

function inRange(level: Level, range: LevelRange): boolean {
  return level >= range.min && level <= range.max;
}

/**
 * Does this word survive the progress-side filter?
 *
 * With no vector named, ANY enabled vector in range is a match — the same way
 * session composition treats dueness, where a word is due if any of its vectors
 * is.
 */
export function matchesProgressFilter(
  progress: WordProgress | undefined,
  filter: ProgressFilter,
  enabledVectors: readonly VectorId[],
): boolean {
  if (progress?.hidden && !filter.includeHidden) return false;
  if (!filter.levels) return true;

  const consulted = filter.vectorId ? [filter.vectorId] : enabledVectors;
  return consulted.some((id) => inRange(levelOf(progress, id), filter.levels!));
}

/** One row the mass-edit will write. */
export interface PlannedWrite {
  wordKey: WordKey;
  vectorId: VectorId;
  from: Level;
  level: Level;
  dueDay: DayNumber;
  /** True when this vector had no due day and one was assigned. */
  scheduled: boolean;
}

export interface SampleRow {
  wordKey: WordKey;
  term: string;
  partOfSpeech: string;
  vectorId: VectorId;
  from: Level;
  to: Level;
}

export interface MassEditPlan {
  operation: MassEditOperation;
  /** Every word the operation touches, in selection order. */
  wordKeys: WordKey[];
  /** Progress rows to write. Empty for hide/unhide and deck membership. */
  writes: PlannedWrite[];
  wordsAffected: number;
  /**
   * The warning number: WORDS that lose mastery on at least one vector.
   *
   * Counted in words rather than vectors because the operation is word-scoped —
   * setting a level writes every vector — so "2 vectors move down" invites the
   * reading that two vectors could be dealt with separately, which they cannot.
   */
  downwardWords: number;
  /** Words that gain `introducedOn` — unstudied words being claimed as known. */
  introduced: WordKey[];
  sample: SampleRow[];
}

export interface PlanInput {
  words: readonly SelectableWord[];
  progress: ReadonlyMap<WordKey, WordProgress>;
  operation: MassEditOperation;
  enabledVectors: readonly VectorId[];
  today: DayNumber;
  /** Words per day the stagger may schedule. See `staggerRate`. */
  rate: number;
  sampleSize?: number;
}

const DEFAULT_SAMPLE_SIZE = 20;

/**
 * How many words a day the stagger may land.
 *
 * Half the deck's session cap, so a claimed-known batch never fills a session on
 * its own and genuine reviews always have room. A full cap would drain faster
 * but crowd out the words the user is actually learning for as long as it took.
 */
export function staggerRate(cardCap: number): number {
  return Math.max(1, Math.floor(cardCap / 2));
}

/**
 * Work out everything the UI and the repository need, before either acts.
 *
 * Due days: an existing one is NEVER moved, in either direction — a demotion
 * changes the ladder position, not the arrival, and the next review at the old
 * interval is itself the check. A vector with no due day gets one, staggered:
 *
 *     dueDay = today + intervalForLevel(newLevel) + floor(n / rate)
 *
 * where `n` counts words needing scheduling. The level's interval decides when
 * the batch STARTS arriving; the stagger decides how it SPREADS. Both vectors of
 * one word share an offset, since one word yields one card either way.
 */
export function planMassEdit(input: PlanInput): MassEditPlan {
  const { words, progress, operation, enabledVectors, today, rate } = input;

  const wordKeys = words.map((w) => w.key);
  const writes: PlannedWrite[] = [];
  const introduced: WordKey[] = [];

  if (operation.kind === 'setLevel') {
    const level = operation.level;
    let scheduledWords = 0;

    for (const word of words) {
      const current = progress.get(word.key);
      if (current?.introducedOn === undefined) introduced.push(word.key);

      // One offset per WORD, not per vector: a word yields one card, so its
      // vectors arriving on the same day is the honest shape.
      const needsSchedule = enabledVectors.some(
        (id) => current?.vectors[id]?.dueDay === undefined,
      );
      const offset = needsSchedule ? Math.floor(scheduledWords / rate) : 0;
      if (needsSchedule) scheduledWords += 1;

      for (const vectorId of enabledVectors) {
        const existing = current?.vectors[vectorId];
        const from = existing?.level ?? NEW_LEVEL;
        writes.push({
          wordKey: word.key,
          vectorId,
          from,
          level,
          dueDay: existing?.dueDay ?? today + intervalForLevel(level) + offset,
          scheduled: existing?.dueDay === undefined,
        });
      }
    }
  }

  return {
    operation,
    wordKeys,
    writes,
    wordsAffected: words.length,
    downwardWords: new Set(
      writes.filter((w) => w.level < w.from).map((w) => w.wordKey),
    ).size,
    introduced,
    sample: buildSample(words, writes, operation, input.sampleSize ?? DEFAULT_SAMPLE_SIZE),
  };
}

/**
 * An evenly spread sample rather than the first N.
 *
 * The sample's job is to make a mis-aimed selection visible — if the intent was
 * "only verbs", nouns showing up says so. Taking the first N of an
 * alphabetically ordered selection would show twenty words starting with A,
 * which reveals nothing about the rest.
 */
function buildSample(
  words: readonly SelectableWord[],
  writes: readonly PlannedWrite[],
  operation: MassEditOperation,
  size: number,
): SampleRow[] {
  if (words.length === 0) return [];

  const byWord = new Map<WordKey, PlannedWrite[]>();
  for (const write of writes) {
    const list = byWord.get(write.wordKey) ?? [];
    list.push(write);
    byWord.set(write.wordKey, list);
  }

  const count = Math.min(size, words.length);
  const rows: SampleRow[] = [];

  for (let i = 0; i < count; i += 1) {
    const word = words[Math.floor((i * words.length) / count)]!;
    const forWord = byWord.get(word.key) ?? [];

    if (operation.kind !== 'setLevel' || forWord.length === 0) {
      rows.push({
        wordKey: word.key,
        term: word.term,
        partOfSpeech: word.partOfSpeech,
        vectorId: '',
        from: NEW_LEVEL,
        to: NEW_LEVEL,
      });
      continue;
    }

    for (const write of forWord) {
      rows.push({
        wordKey: word.key,
        term: word.term,
        partOfSpeech: word.partOfSpeech,
        vectorId: write.vectorId,
        from: write.from,
        to: write.level,
      });
    }
  }

  return rows;
}
