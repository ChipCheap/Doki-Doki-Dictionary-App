/**
 * S8 (dictionary half) — the stores this module owns.
 *
 * Reference data: read-only after install, replaceable wholesale, and never
 * part of an export because it is reproducible from the pack.
 *
 * Indexes are declared here rather than shipped inside the pack: IndexedDB
 * builds and maintains exactly the ones the pack was going to carry, so
 * shipping them would mean redundant bytes and a second source of truth that
 * can drift (architecture.md D4).
 */

import type { DictionaryEntry } from './pack-format';

export type { DictionaryEntry };

/** What the app remembers about an installed language pack. */
export interface InstalledPack {
  /** Target language code. One pack per language. */
  id: string;
  languageName: string;
  baseLanguage: string;
  packVersion: string;
  schemaVersion: number;
  entryCount: number;
  installedOn: number;
  /**
   * Written LAST, after every row lands. A pack without it is treated as absent
   * and reinstalled — which makes a half-written install self-correcting
   * without a verification scan over every row (architecture.md D-S11).
   */
  ready: boolean;
}

export const DICTIONARY_STORES = {
  entries:
    'key, language, partOfSpeech, difficulty, term, *contextTags, *meanings, [language+partOfSpeech], [language+difficulty]',
  packs: 'id, language, ready',
} as const;
