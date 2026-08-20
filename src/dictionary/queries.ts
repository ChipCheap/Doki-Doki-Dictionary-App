/**
 * S12 — dictionary lookups.
 *
 * A query API rather than raw rows, so filtering thousands of entries stays out
 * of `domain` — which may not know about storage (architecture.md guideline 1).
 * Returns plain data; no domain logic lives here.
 */

import { db } from '../database';
import { normalize } from '../domain/matching';
import type { DifficultyTier, WordKey } from '../domain/types';
import type { DeckRecipe } from '../progress/schema';
import type { DictionaryEntry } from './pack-format';

export async function getEntry(key: WordKey): Promise<DictionaryEntry | undefined> {
  return db.entries.get(key);
}

export async function getEntries(keys: readonly WordKey[]): Promise<DictionaryEntry[]> {
  const rows = await db.entries.bulkGet([...keys]);
  return rows.filter((r): r is DictionaryEntry => r !== undefined);
}

export async function countEntries(language: string): Promise<number> {
  return db.entries.where('language').equals(language).count();
}

/**
 * Candidates for multiple choice. Drawn by part of speech; the caller applies
 * the same-spelling exclusion and the deck-first preference, both of which are
 * domain rules.
 */
export async function entriesByPartOfSpeech(
  language: string,
  partOfSpeech: string,
  limit = 200,
): Promise<DictionaryEntry[]> {
  return db.entries
    .where('[language+partOfSpeech]')
    .equals([language, partOfSpeech])
    .limit(limit)
    .toArray();
}

/** A cheap sample for when the part-of-speech constraint has to be relaxed. */
export async function entriesForLanguage(
  language: string,
  limit = 200,
): Promise<DictionaryEntry[]> {
  return db.entries.where('language').equals(language).limit(limit).toArray();
}

/**
 * Entries that share a meaning with the given one, same part of speech,
 * excluding itself.
 *
 * Backs the "valid word, but not the one asked for" rejection: prompted with
 * *to leave* for `salir`, a user typing `dejar` has produced a real translation
 * and should be told so rather than marked wrong.
 */
export async function synonymEntries(
  entry: DictionaryEntry,
): Promise<DictionaryEntry[]> {
  const seen = new Map<WordKey, DictionaryEntry>();

  for (const meaning of entry.meanings) {
    const matches = await db.entries
      .where('meanings')
      .equalsIgnoreCase(meaning)
      .toArray();

    for (const match of matches) {
      if (match.key === entry.key) continue;
      if (match.language !== entry.language) continue;
      if (match.partOfSpeech !== entry.partOfSpeech) continue;
      seen.set(match.key, match);
    }
  }

  return [...seen.values()];
}

/** Target terms of synonymous entries — what the matcher actually needs. */
export async function synonymTerms(entry: DictionaryEntry): Promise<string[]> {
  const entries = await synonymEntries(entry);
  const own = new Set(entry.meanings.map(normalize));
  return entries
    .filter((e) => e.meanings.some((m) => own.has(normalize(m))))
    .map((e) => e.term);
}

/**
 * Resolve a deck recipe to member keys.
 *
 * `sequence`-tagged words are excluded unless explicitly asked for: numbers,
 * weekdays and months are learned as an ordered series, and nobody wants
 * 1, 20, 100000, 7, 14 jumbled into a quiz.
 */
export async function entriesForRecipe(
  language: string,
  recipe: DeckRecipe,
): Promise<DictionaryEntry[]> {
  const rows = await db.entries.where('language').equals(language).toArray();

  const wantedTiers = new Set(recipe.difficulties);
  const wantedTags = new Set(recipe.contextTags);

  return rows.filter((entry) => {
    if (!recipe.includeSequence && entry.sequence !== undefined) return false;

    // Empty group = no constraint. Within a group the terms are OR'd; the two
    // groups are AND'd — so "advanced" + "finance" means advanced finance
    // words, while "basic" + "common" means either tier.
    if (wantedTiers.size > 0 && !wantedTiers.has(entry.difficulty)) return false;
    if (wantedTags.size > 0 && !entry.contextTags.some((tag) => wantedTags.has(tag))) return false;

    return true;
  });
}

/** How many words a recipe would select, for the preview before committing. */
export async function countForRecipe(language: string, recipe: DeckRecipe): Promise<number> {
  return (await entriesForRecipe(language, recipe)).length;
}

/** Difficulty tiers actually present in a language, for the quick-create buttons. */
export async function availableTiers(language: string): Promise<DifficultyTier[]> {
  const rows = await db.entries.where('language').equals(language).toArray();
  return [...new Set(rows.map((r) => r.difficulty))];
}

/** Context tags actually present, so quick-create never offers an empty button. */
export async function availableTags(language: string): Promise<string[]> {
  const rows = await db.entries.where('language').equals(language).toArray();
  return [...new Set(rows.flatMap((r) => r.contextTags))].sort();
}
