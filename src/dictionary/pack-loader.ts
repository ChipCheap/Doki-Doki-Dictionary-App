/**
 * S10 — parsing and the core/meaning layer merge.
 *
 * architecture.md D5: the two layers are merged AT INSTALL, not joined at read
 * time. The split exists to save download size — a second base language costs
 * ~4 MB instead of ~10 MB — and once the data is on the device that reason is
 * gone. Every later lookup is then a single fetch.
 */

import {
  assertSupportedSchema,
  PackShapeError,
  validateCoreEntries,
  validateMeaningEntries,
  type CorePack,
  type DictionaryEntry,
  type MeaningPack,
} from './pack-format';

export interface MergeReport {
  language: string;
  baseLanguage: string;
  packVersion: string;
  entries: DictionaryEntry[];
  /** Malformed entries dropped from either layer, with reasons. */
  skipped: { key: string; reason: string }[];
  /** Core entries with no matching meaning row — not testable, so not shipped. */
  withoutMeaning: string[];
  /** Entries carrying fewer than two examples. Best-effort, never a rejection. */
  thinExamples: number;
}

/**
 * Merge a core layer with a meaning layer into rows ready to store.
 *
 * A core entry with no meaning row is dropped: there would be nothing to accept
 * as an answer. It is counted rather than silently discarded, because on a thin
 * language that count is the signal that the meaning layer needs work.
 */
export function mergePack(core: CorePack, meaning: MeaningPack): MergeReport {
  assertSupportedSchema(core.schemaVersion);
  assertSupportedSchema(meaning.schemaVersion);

  if (core.language !== meaning.language) {
    throw new PackShapeError(
      `Layer mismatch: core pack is for "${core.language}" but the meaning layer covers "${meaning.language}".`,
    );
  }

  const coreResult = validateCoreEntries(core.entries ?? []);
  const meaningResult = validateMeaningEntries(meaning.entries ?? []);

  const meaningByKey = new Map(meaningResult.valid.map((m) => [m.key, m]));

  const entries: DictionaryEntry[] = [];
  const withoutMeaning: string[] = [];
  let thinExamples = 0;

  for (const entry of coreResult.valid) {
    const meanings = meaningByKey.get(entry.key);
    if (!meanings) {
      withoutMeaning.push(entry.key);
      continue;
    }

    const examples = (entry.examples ?? []).map((example) => {
      const translation = meanings.exampleTranslations?.[example.id];
      return {
        id: example.id,
        text: example.text,
        ...(translation ? { translation } : {}),
        ...(example.source ? { source: example.source } : {}),
      };
    });

    // packs.framework.md: two examples preferred, fewer accepted, never a
    // reason to drop a word. A common word with one example beats a missing one.
    if (examples.length < 2) thinExamples += 1;

    entries.push({
      key: entry.key,
      language: core.language,
      baseLanguage: meaning.baseLanguage,
      term: entry.term,
      partOfSpeech: entry.partOfSpeech,
      difficulty: entry.difficulty,
      contextTags: entry.contextTags ?? [],
      ...(entry.sequence ? { sequence: entry.sequence } : {}),
      ...(entry.gender ? { gender: entry.gender } : {}),
      ...(entry.article ? { article: entry.article } : {}),
      meanings: meanings.meanings,
      examples,
    });
  }

  return {
    language: core.language,
    baseLanguage: meaning.baseLanguage,
    packVersion: core.packVersion,
    entries,
    skipped: [...coreResult.skipped, ...meaningResult.skipped],
    withoutMeaning,
    thinExamples,
  };
}

/** Fetch and parse a pack layer. Network failure and bad JSON both surface. */
export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new PackShapeError(`Could not load ${url} (${response.status}).`);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new PackShapeError(`${url} is not valid JSON.`);
  }
}
