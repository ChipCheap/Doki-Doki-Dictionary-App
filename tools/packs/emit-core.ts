/**
 * S12 — the core layer.
 *
 * One per target language: senses, terms, part of speech, difficulty, context
 * and sequence tags, gender, article, and target-language example sentences.
 * Identical for every base language, which is what makes adding a base language
 * a small file rather than a second full download.
 *
 * NO INDEXES. `architecture.md` D4 has the app build its own at install, and
 * `pack-format.ts` has no field to carry one — shipping them would duplicate
 * data the app derives in a second anyway.
 */

import type { CorePack, CorePackEntry } from '../../src/dictionary/pack-format';
import { SUPPORTED_SCHEMA_VERSION } from '../../src/dictionary/pack-format';
import type { SourceSpec } from './sources';

export interface CoreEmitInput {
  language: string;
  languageName: string;
  packVersion: string;
  entries: CorePackEntry[];
  sources: readonly SourceSpec[];
}

export function buildCorePack(input: CoreEmitInput): CorePack {
  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    packVersion: input.packVersion,
    language: input.language,
    languageName: input.languageName,
    // Sorted by key so a rebuild of unchanged data produces an identical file
    // and a pack diff shows only what actually moved.
    entries: [...input.entries].sort((a, b) => a.key.localeCompare(b.key)),
    sources: input.sources.map((s) => ({
      name: s.attribution,
      licence: s.licence,
      url: s.url,
    })),
  };
}
