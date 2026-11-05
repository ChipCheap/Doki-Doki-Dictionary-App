/**
 * S16 — export and import.
 *
 * framework.md reframes this: export/import is DISASTER RECOVERY, not only
 * portability. Browser storage can be cleared by the user, evicted under disk
 * pressure, or deleted by Safari after seven days without interaction — so this
 * is the only thing standing between a cleared browser and months of lost work.
 *
 * The dictionary is never exported. It is reproducible from the pack, so
 * carrying ~10 MB of it in a profile file would be pure waste.
 */

import { db } from '../database';
import type { DeckRow, EntryEdits, ProgressRow, WordRow } from './schema';
import { bumpRevision, getRevision } from './progress-repo';
import {
  DEFAULT_GLOBAL_SETTINGS,
  getGlobalSettings,
  type GlobalSettings,
} from './settings-repo';

export const PROFILE_SCHEMA_VERSION = 1;

export interface ProfileExport {
  schemaVersion: number;
  exportedAt: string;
  revision: number;
  progress: ProgressRow[];
  words: WordRow[];
  decks: DeckRow[];
  /** Corrections to dictionary entries — user data, unlike the entries themselves. */
  entryEdits: EntryEdits[];
  settings: GlobalSettings;
}

export interface TransferCounts {
  words: number;
  vectorStates: number;
  decks: number;
  /** Words with a corrected meaning or example. */
  corrections: number;
}

export class ProfileSchemaError extends Error {
  constructor(readonly found: number) {
    super(
      `This profile was saved by a newer version of the app (format ${found}, this app understands ${PROFILE_SCHEMA_VERSION}). Update the app before importing it.`,
    );
    this.name = 'ProfileSchemaError';
  }
}

export class ProfileShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileShapeError';
  }
}

export async function exportProfile(): Promise<ProfileExport> {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    revision: await getRevision(),
    progress: await db.progress.toArray(),
    words: await db.words.toArray(),
    decks: await db.decks.toArray(),
    entryEdits: await db.entryEdits.toArray(),
    settings: await getGlobalSettings(),
  };
}

export function countsOf(profile: ProfileExport): TransferCounts {
  return {
    words: profile.words.length,
    vectorStates: profile.progress.length,
    decks: profile.decks.length,
    corrections: profile.entryEdits.length,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A correction row as it must look to be applied. Malformed rows are dropped
 * rather than failing the import: a correction is a convenience, the progress
 * beside it is not.
 */
function isEntryEdits(value: unknown): value is EntryEdits {
  return (
    isRecord(value) &&
    typeof value.wordKey === 'string' &&
    isRecord(value.meanings) &&
    isRecord(value.examples)
  );
}

/**
 * Validate a candidate profile WITHOUT applying it, so the UI can state exactly
 * what will happen — and how much will be replaced — before the user commits.
 * Import is destructive; a silent one is the failure mode that hurts most.
 */
export function parseProfile(raw: unknown): ProfileExport {
  if (typeof raw !== 'object' || raw === null) {
    throw new ProfileShapeError('That file is not a profile export.');
  }

  const candidate = raw as Partial<ProfileExport>;

  if (typeof candidate.schemaVersion !== 'number') {
    throw new ProfileShapeError('That file is missing its format version.');
  }
  if (candidate.schemaVersion > PROFILE_SCHEMA_VERSION) {
    throw new ProfileSchemaError(candidate.schemaVersion);
  }
  if (
    !Array.isArray(candidate.progress) ||
    !Array.isArray(candidate.words) ||
    !Array.isArray(candidate.decks)
  ) {
    throw new ProfileShapeError('That profile is missing its progress, words or decks.');
  }

  return {
    schemaVersion: candidate.schemaVersion,
    exportedAt: candidate.exportedAt ?? '',
    revision: candidate.revision ?? 0,
    progress: candidate.progress,
    words: candidate.words,
    decks: candidate.decks,
    // Absent corrections are legitimate too: every export made before they
    // existed has none.
    entryEdits: Array.isArray(candidate.entryEdits) ? candidate.entryEdits.filter(isEntryEdits) : [],
    // Absent settings are legitimate: an older export, or a hand-edited file.
    // The stored defaults apply on import rather than failing the whole thing.
    settings: candidate.settings ?? DEFAULT_GLOBAL_SETTINGS,
  };
}

/**
 * Replace local progress entirely.
 *
 * No merging: framework.md decided full replacement with a confirmation step,
 * because reconciling two divergent histories is a design problem nobody has
 * solved here yet.
 */
export async function importProfile(profile: ProfileExport): Promise<TransferCounts> {
  const stores = [db.progress, db.words, db.decks, db.entryEdits, db.settings];
  await db.transaction('rw', stores, async () => {
    await db.progress.clear();
    await db.words.clear();
    await db.decks.clear();
    await db.entryEdits.clear();

    if (profile.progress.length > 0) await db.progress.bulkPut(profile.progress);
    if (profile.words.length > 0) await db.words.bulkPut(profile.words);
    if (profile.decks.length > 0) await db.decks.bulkPut(profile.decks);
    if (profile.entryEdits.length > 0) await db.entryEdits.bulkPut(profile.entryEdits);

    if (profile.settings) {
      await db.settings.put({ key: 'globalSettings', value: profile.settings });
    }
  });

  await bumpRevision();
  return countsOf(profile);
}

/** Serialize for download. Indented so a hand-edit stays feasible. */
export function toFileContents(profile: ProfileExport): string {
  return JSON.stringify(profile, null, 2);
}

export function suggestedFileName(): string {
  const day = new Date().toISOString().slice(0, 10);
  return `doki-dictionary-profile-${day}.json`;
}
