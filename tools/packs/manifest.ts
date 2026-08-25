/**
 * S14 — the manifest.
 *
 * Records what a pack is made of and under what terms. The sources are
 * share-alike, so a derived pack must itself be CC BY-SA — `framework.md`'s
 * licensing section makes that an obligation, not a courtesy, and it is not
 * relaxed by the app being free and non-commercial.
 *
 * Dump dates are pinned here so a build is repeatable: given this manifest and
 * `sources.lock.json`, the same pack can be produced again.
 */

import { writeFile } from 'node:fs/promises';
import type { LockedSource, SourceSpec } from './sources';
import type { Reports } from './reports';

export const PACK_LICENCE = 'CC BY-SA 4.0';

export interface Manifest {
  language: string;
  languageName: string;
  baseLanguage: string;
  packVersion: string;
  schemaVersion: number;
  entryCount: number;
  builtAt: string;
  licence: string;
  licenceNote: string;
  sources: {
    name: string;
    licence: string;
    url: string;
    fetchedAt?: string;
    bytes?: number;
  }[];
  reportSummary: {
    examplesWithTwo: number;
    examplesWithNone: number;
    contextTagPercent: number;
    homographTerms: number;
    keysMinted: number;
    keysOrphaned: number;
  };
}

export function buildManifest(input: {
  language: string;
  languageName: string;
  baseLanguage: string;
  packVersion: string;
  schemaVersion: number;
  entryCount: number;
  specs: readonly SourceSpec[];
  locked: readonly LockedSource[];
  reports: Reports;
}): Manifest {
  const lockedById = new Map(input.locked.map((l) => [l.id, l]));

  return {
    language: input.language,
    languageName: input.languageName,
    baseLanguage: input.baseLanguage,
    packVersion: input.packVersion,
    schemaVersion: input.schemaVersion,
    entryCount: input.entryCount,
    builtAt: new Date().toISOString(),
    licence: PACK_LICENCE,
    licenceNote:
      'Derived from share-alike sources, so this pack is itself CC BY-SA. ' +
      'Attribution for every source is listed below and must travel with the data.',
    sources: input.specs.map((spec) => {
      const locked = lockedById.get(spec.id);
      return {
        name: spec.attribution,
        licence: spec.licence,
        url: spec.url,
        ...(locked ? { fetchedAt: locked.fetchedAt, bytes: locked.bytes } : {}),
      };
    }),
    reportSummary: {
      examplesWithTwo: input.reports.exampleCoverage.withTwo,
      examplesWithNone: input.reports.exampleCoverage.withNone,
      contextTagPercent: input.reports.contextTagCoverage.percent,
      homographTerms: input.reports.homographs.length,
      keysMinted: input.reports.keyChurn.minted.length,
      keysOrphaned: input.reports.keyChurn.orphaned.length,
    },
  };
}

export async function writeManifest(path: string, manifest: Manifest): Promise<void> {
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}
