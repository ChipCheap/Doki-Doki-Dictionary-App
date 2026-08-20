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
import type { DeckRow, ProgressRow, WordRow } from './schema';
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
  settings: GlobalSettings;
}

export interface TransferCounts {
  words: number;
  vectorStates: number;
  decks: number;
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
    settings: await getGlobalSettings(),
  };
}

export function countsOf(profile: ProfileExport): TransferCounts {
  return {
    words: profile.words.length,
    vectorStates: profile.progress.length,
    decks: profile.decks.length,
  };
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
  await db.transaction('rw', db.progress, db.words, db.decks, db.settings, async () => {
    await db.progress.clear();
    await db.words.clear();
    await db.decks.clear();

    if (profile.progress.length > 0) await db.progress.bulkPut(profile.progress);
    if (profile.words.length > 0) await db.words.bulkPut(profile.words);
    if (profile.decks.length > 0) await db.decks.bulkPut(profile.decks);

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
