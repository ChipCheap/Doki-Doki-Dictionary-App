/**
 * S11 — pack install.
 *
 * The one place in the app where a genuine wait is expected, so it is explicit
 * and reports real progress rather than hiding behind a spinner
 * (framework.md invariant 10).
 */

import { db } from '../database';
import type { InstalledPack } from './schema';
import { mergePack, type MergeReport } from './pack-loader';
import { SUPPORTED_SCHEMA_VERSION, type CorePack, type MeaningPack } from './pack-format';

/** Rows per write. Large enough to be fast, small enough to report progress. */
const CHUNK = 500;

export interface InstallProgress {
  /** 0–1. */
  fraction: number;
  written: number;
  total: number;
}

export interface InstallResult {
  language: string;
  entryCount: number;
  skipped: MergeReport['skipped'];
  withoutMeaning: string[];
  thinExamples: number;
}

/**
 * Install a language pack, replacing any existing rows for that language.
 *
 * Progress rows are never touched: a pack update adds and replaces dictionary
 * content, and a word that disappears keeps its progress on disk even though it
 * is no longer served.
 */
export async function installPack(
  core: CorePack,
  meaning: MeaningPack,
  onProgress?: (p: InstallProgress) => void,
): Promise<InstallResult> {
  const merged = mergePack(core, meaning);
  const total = merged.entries.length;

  // Clear the ready flag FIRST. If anything below fails, the pack reads as
  // absent on next launch and is reinstalled, rather than looking complete
  // while half its rows are missing.
  await db.packs.put({
    id: merged.language,
    languageName: core.languageName,
    baseLanguage: merged.baseLanguage,
    packVersion: merged.packVersion,
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    entryCount: total,
    installedOn: Date.now(),
    ready: false,
  });

  await db.entries.where('language').equals(merged.language).delete();

  let written = 0;
  for (let i = 0; i < total; i += CHUNK) {
    await db.entries.bulkPut(merged.entries.slice(i, i + CHUNK));
    written = Math.min(i + CHUNK, total);
    onProgress?.({ fraction: total === 0 ? 1 : written / total, written, total });
  }

  // Written last, as the final operation. This is the whole mechanism.
  await db.packs.update(merged.language, { ready: true });

  return {
    language: merged.language,
    entryCount: total,
    skipped: merged.skipped,
    withoutMeaning: merged.withoutMeaning,
    thinExamples: merged.thinExamples,
  };
}

/** A pack without its ready flag counts as not installed. */
export async function isPackInstalled(language: string): Promise<boolean> {
  const pack = await db.packs.get(language);
  return pack?.ready === true;
}

export async function listInstalledPacks(): Promise<InstalledPack[]> {
  const packs = await db.packs.toArray();
  return packs.filter((p) => p.ready).sort((a, b) => a.id.localeCompare(b.id));
}

/** Remove a language's dictionary rows. Progress is deliberately left alone. */
export async function removePack(language: string): Promise<void> {
  await db.entries.where('language').equals(language).delete();
  await db.packs.delete(language);
}
