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
   * Where this pack's data came from, copied off the pack at install.
   *
   * Persisted rather than fetched because attribution is a licence obligation
   * that does not pause when the network does — and `public/packs/**` is
   * excluded from the service-worker precache, so a screen reading the manifest
   * would be blank offline. Taken from the pack rather than hard-coded so a
   * pack built later, for a language this build has never heard of, attributes
   * itself with no code change.
   *
   * Optional only for rows written before database version 4; the v4 upgrade
   * clears `ready` on those so they are reinstalled rather than displayed
   * without their sources.
   */
  sources?: { name: string; licence: string; url?: string }[];
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
