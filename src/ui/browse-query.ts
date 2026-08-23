/**
 * Composition for browse and mass-edit selection.
 *
 * A selection has two halves that live in different modules: the dictionary
 * resolves tier, tag, deck membership and text; `domain` resolves level and
 * vector against progress. Neither module may see the other, so composing them
 * belongs to `ui`, which is what `ui` is for (architecture.md D1). Nothing here
 * touches storage directly — it calls each module's public surface.
 *
 * The cost split matters and is deliberate:
 *  - `words` (hidden flags) is always read, because hiding changes WHICH words
 *    land on which page, and it is one row per word the user has touched.
 *  - `progress` is read ENTIRE only when a level or vector filter is active,
 *    because such a filter must run before paging or the page and the count are
 *    both computed from data that was never read.
 *  - Otherwise progress is fetched for the visible page only.
 */

import { displayWithArticle } from '../domain/articles';
import {
  matchesProgressFilter,
  type ProgressFilter,
  type SelectableWord,
} from '../domain/maintenance';
import type { WordKey, WordProgress } from '../domain/types';
import type { VectorId } from '../domain/vectors';
import { browseCandidates, type BrowseFilter } from '../dictionary/queries';
import type { DictionaryEntry } from '../dictionary/pack-format';
import {
  getAllWordProgress,
  getHiddenKeys,
  getWordProgress,
} from '../progress/progress-repo';

export const PAGE_SIZE = 200;

export interface SelectionInput {
  browse: BrowseFilter;
  progress: ProgressFilter;
  enabledVectors: readonly VectorId[];
}

export interface SelectionResult {
  /** Everything matching, in display order. Keys only — rows come per page. */
  matches: DictionaryEntry[];
  /** How many hidden words the filter excluded, for the reveal control. */
  hiddenExcluded: number;
  /**
   * Every hidden word. Returned rather than re-derived from paged progress: a
   * hidden word past the first page would otherwise render without its flag.
   */
  hidden: Set<WordKey>;
}

function needsFullProgress(filter: ProgressFilter): boolean {
  return filter.levels !== undefined || filter.vectorId !== undefined;
}

/** Resolve a full selection. The caller pages the result. */
export async function resolveSelection(input: SelectionInput): Promise<SelectionResult> {
  const candidates = await browseCandidates(input.browse);

  const hidden = await getHiddenKeys();
  const progress = needsFullProgress(input.progress)
    ? await getAllWordProgress()
    : undefined;

  let hiddenExcluded = 0;
  const matches: DictionaryEntry[] = [];

  for (const entry of candidates) {
    const isHidden = hidden.has(entry.key);
    if (isHidden && !input.progress.includeHidden) {
      hiddenExcluded += 1;
      continue;
    }

    if (progress) {
      const word = progress.get(entry.key) ?? { key: entry.key, vectors: {} };
      const withHidden: WordProgress = isHidden ? { ...word, hidden: true } : word;
      if (!matchesProgressFilter(withHidden, input.progress, input.enabledVectors)) continue;
    }

    matches.push(entry);
  }

  return { matches, hiddenExcluded, hidden };
}

/** Progress for one visible page — the cheap path when nothing filters on it. */
export async function progressForPage(
  entries: readonly DictionaryEntry[],
): Promise<Map<WordKey, WordProgress>> {
  return getWordProgress(entries.map((e) => e.key));
}

/**
 * The shape `planMassEdit` selects over.
 *
 * `term` carries the article — `el agua` — because its only use is the
 * mass-edit sample, and that sample is there to be read. Sorting still happens
 * on the bare term in `browseCandidates`, so the list does not collect under
 * "el" and "la".
 */
export function toSelectable(entries: readonly DictionaryEntry[]): SelectableWord[] {
  return entries.map((e) => ({
    key: e.key,
    term: displayWithArticle(e.language, e.term, e.gender, e.article),
    partOfSpeech: e.partOfSpeech,
  }));
}
