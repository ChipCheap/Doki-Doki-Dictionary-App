/**
 * S13 — the meaning layer.
 *
 * One per (target, base) pair: the English meanings of each sense, and the
 * translations of the core layer's example sentences.
 *
 * NO SYNONYMS. The framework lists them as a meaning-layer field but requires
 * them DERIVED rather than authored, and the app already derives them at query
 * time from the meanings index (`queries.ts`). Shipping them would be a second
 * source of truth that drifts from the first.
 */

import type { MeaningPack, MeaningPackEntry } from '../../src/dictionary/pack-format';
import { SUPPORTED_SCHEMA_VERSION } from '../../src/dictionary/pack-format';

export interface MeaningEmitInput {
  language: string;
  baseLanguage: string;
  packVersion: string;
  entries: MeaningPackEntry[];
}

export function buildMeaningPack(input: MeaningEmitInput): MeaningPack {
  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    packVersion: input.packVersion,
    language: input.language,
    baseLanguage: input.baseLanguage,
    entries: [...input.entries].sort((a, b) => a.key.localeCompare(b.key)),
  };
}
