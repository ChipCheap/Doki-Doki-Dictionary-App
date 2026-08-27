/**
 * The single Dexie connection.
 *
 * `dictionary` and `progress` each declare the stores they own; this file only
 * composes them into one database. Neither module imports the other, which is
 * what keeps the boundary in architecture.md D1 real rather than decorative.
 *
 * Migrations are declared as cumulative Dexie versions from the first schema
 * onward and are never destructive — assume a user skipped a year of updates
 * (architecture.md guideline 7).
 */

import Dexie, { type Table } from 'dexie';
import { DICTIONARY_STORES, type DictionaryEntry, type InstalledPack } from './dictionary/schema';
import {
  PROGRESS_STORES,
  SNAPSHOT_STORES,
  type DeckRecipe,
  type DeckRow,
  type LegacyDeckRecipe,
  type ProgressRow,
  type SettingRow,
  type SnapshotRow,
  type WordRow,
} from './progress/schema';

export class AppDatabase extends Dexie {
  entries!: Table<DictionaryEntry, string>;
  packs!: Table<InstalledPack, string>;
  progress!: Table<ProgressRow, [string, string]>;
  words!: Table<WordRow, string>;
  decks!: Table<DeckRow, string>;
  settings!: Table<SettingRow, string>;
  snapshots!: Table<SnapshotRow, string>;

  constructor(name = 'doki-doki-dictionary') {
    super(name);

    this.version(1).stores({ ...DICTIONARY_STORES, ...PROGRESS_STORES });

    // v2: deck recipes gained multi-select — difficulties and context tags are
    // now lists, OR'd within a group and AND'd between them. Non-destructive:
    // every old recipe maps onto exactly one new one, and decks keep their
    // members regardless, since membership is stored rather than derived.
    this.version(2).upgrade(async (tx) => {
      const decks = tx.table<DeckRow, string>('decks');
      await decks.toCollection().modify((deck) => {
        const legacy = deck.recipe as unknown as LegacyDeckRecipe;
        if (!legacy || !('kind' in legacy)) return;

        deck.recipe = {
          difficulties:
            legacy.kind === 'difficulty' && legacy.value
              ? [legacy.value as DeckRecipe['difficulties'][number]]
              : [],
          contextTags: legacy.kind === 'contextTag' && legacy.value ? [legacy.value] : [],
          includeSequence: legacy.includeSequence ?? false,
        };
      });
    });

    // v3: snapshots, for the mass-edit undo. Purely additive — a new store and
    // no change to any existing row, so an upgrade from v1 or v2 carries every
    // deck and every progress row across untouched.
    this.version(3).stores({ ...SNAPSHOT_STORES });

    // v4: packs record the sources they were built from, so the attributions
    // screen works offline. A pack installed before this carries none, and a
    // language shown without its attribution is the same licence failure as
    // having no screen at all — so its ready flag is cleared and the existing
    // install flow rebuilds it. Non-destructive: only the flag is touched, and
    // progress rows are never part of a pack.
    this.version(4).upgrade(async (tx) => {
      const packs = tx.table<InstalledPack, string>('packs');
      await packs.toCollection().modify((pack) => {
        if (!pack.sources || pack.sources.length === 0) pack.ready = false;
      });
    });
  }
}

export const db = new AppDatabase();
