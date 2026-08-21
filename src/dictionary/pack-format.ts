/**
 * S9 — pack format types and validation.
 *
 * packs.framework.md: a pack splits into a CORE layer (per target language:
 * senses, terms, part of speech, tags, target-language sentences) and a MEANING
 * layer (per base language: meanings, example translations). The split exists so
 * a second base language costs a small file rather than a second full download.
 *
 * The reader TOLERATES UNKNOWN FIELDS — a newer pack must never break an older
 * app (architecture.md guideline 5).
 */

import { isGender, type Gender } from '../domain/articles';
import type { DifficultyTier, WordKey } from '../domain/types';
import { DIFFICULTY_TIERS } from '../domain/types';

export type { Gender };

/** Bumped only when the shape changes incompatibly. Additions do not bump it. */
export const SUPPORTED_SCHEMA_VERSION = 1;

export interface CoreExample {
  /** Stable within the pack; the meaning layer keys translations off it. */
  id: string;
  text: string;
  /** Tatoeba sentence id or similar, for attribution. */
  source?: string;
}

/** A word in an ordered paradigm — numbers, weekdays, months. */
export interface SequenceTag {
  group: string;
  ordinal: number;
}

export interface CorePackEntry {
  key: WordKey;
  term: string;
  partOfSpeech: string;
  difficulty: DifficultyTier;
  contextTags?: string[];
  sequence?: SequenceTag;
  examples?: CoreExample[];
  /**
   * Grammatical gender, where the language has one. Sourced — Wiktionary tags
   * nouns `masculine` / `feminine` / `neuter` in the same array we already read
   * register labels from.
   */
  gender?: Gender;
  /**
   * Explicit article, for words whose article does not follow from their
   * gender: Spanish `el agua` is feminine but takes `el`, and French elides to
   * `l'`. Overrides the gender rule when present.
   */
  article?: string;
}

export interface CorePack {
  schemaVersion: number;
  packVersion: string;
  /** Target language code, e.g. `vi`. */
  language: string;
  languageName: string;
  entries: CorePackEntry[];
  sources?: { name: string; licence: string; url?: string }[];
}

export interface MeaningPackEntry {
  key: WordKey;
  /** Accepted answers on the base-language side. At least one required. */
  meanings: string[];
  /** Keyed by `CoreExample.id`. Missing translations are allowed. */
  exampleTranslations?: Record<string, string>;
}

export interface MeaningPack {
  schemaVersion: number;
  packVersion: string;
  /** Target language this layer covers. Must match its core pack. */
  language: string;
  /** The learner's own language, e.g. `en`. */
  baseLanguage: string;
  entries: MeaningPackEntry[];
}

/** One row as stored, both layers already merged (architecture.md D5). */
export interface DictionaryEntry {
  key: WordKey;
  language: string;
  baseLanguage: string;
  term: string;
  partOfSpeech: string;
  difficulty: DifficultyTier;
  contextTags: string[];
  sequence?: SequenceTag;
  gender?: Gender;
  article?: string;
  meanings: string[];
  examples: { id: string; text: string; translation?: string; source?: string }[];
}

export class PackSchemaError extends Error {
  constructor(readonly found: number, readonly supported: number) {
    super(
      `This pack uses format version ${found}, but this version of the app understands up to ${supported}. Update the app to install it.`,
    );
    this.name = 'PackSchemaError';
  }
}

export class PackShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackShapeError';
  }
}

/**
 * Reject a pack the app cannot understand, naming the mismatch rather than
 * failing obscurely. An OLDER pack is always fine — fields are only ever added.
 */
export function assertSupportedSchema(version: unknown): void {
  const found = typeof version === 'number' ? version : Number.NaN;
  if (!Number.isFinite(found)) {
    throw new PackShapeError('Pack is missing a schemaVersion.');
  }
  if (found > SUPPORTED_SCHEMA_VERSION) {
    throw new PackSchemaError(found, SUPPORTED_SCHEMA_VERSION);
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDifficulty(value: unknown): value is DifficultyTier {
  return (
    typeof value === 'string' &&
    (DIFFICULTY_TIERS as readonly string[]).includes(value)
  );
}

export interface ValidationOutcome<T> {
  valid: T[];
  /** Entries dropped, with the reason, for the build/install report. */
  skipped: { key: string; reason: string }[];
}

/**
 * Keep well-formed entries, drop the rest with a reason.
 *
 * An entry with no term, no part of speech, or no meaning is not testable —
 * there is nothing to ask or nothing to accept — so it is skipped rather than
 * silently half-loaded.
 */
export function validateCoreEntries(
  entries: readonly unknown[],
): ValidationOutcome<CorePackEntry> {
  const valid: CorePackEntry[] = [];
  const skipped: { key: string; reason: string }[] = [];

  for (const raw of entries) {
    const entry = raw as Partial<CorePackEntry>;
    const key = isNonEmptyString(entry?.key) ? entry.key : '(no key)';

    if (!isNonEmptyString(entry?.key)) {
      skipped.push({ key, reason: 'missing key' });
      continue;
    }
    if (!isNonEmptyString(entry.term)) {
      skipped.push({ key, reason: 'missing term' });
      continue;
    }
    if (!isNonEmptyString(entry.partOfSpeech)) {
      skipped.push({ key, reason: 'missing part of speech' });
      continue;
    }
    if (!isDifficulty(entry.difficulty)) {
      skipped.push({ key, reason: 'missing or unknown difficulty tier' });
      continue;
    }

    valid.push({
      key: entry.key,
      term: entry.term,
      partOfSpeech: entry.partOfSpeech,
      difficulty: entry.difficulty,
      contextTags: Array.isArray(entry.contextTags)
        ? entry.contextTags.filter(isNonEmptyString)
        : [],
      ...(entry.sequence ? { sequence: entry.sequence } : {}),
      // Unknown gender values are dropped rather than failing the entry: a
      // wrong article is worse than none, and the word is still learnable.
      ...(isGender(entry.gender) ? { gender: entry.gender } : {}),
      ...(isNonEmptyString(entry.article) ? { article: entry.article } : {}),
      examples: Array.isArray(entry.examples)
        ? entry.examples.filter((e) => isNonEmptyString(e?.text) && isNonEmptyString(e?.id))
        : [],
    });
  }

  return { valid, skipped };
}

export function validateMeaningEntries(
  entries: readonly unknown[],
): ValidationOutcome<MeaningPackEntry> {
  const valid: MeaningPackEntry[] = [];
  const skipped: { key: string; reason: string }[] = [];

  for (const raw of entries) {
    const entry = raw as Partial<MeaningPackEntry>;
    const key = isNonEmptyString(entry?.key) ? entry.key : '(no key)';

    if (!isNonEmptyString(entry?.key)) {
      skipped.push({ key, reason: 'missing key' });
      continue;
    }
    const meanings = Array.isArray(entry.meanings)
      ? entry.meanings.filter(isNonEmptyString)
      : [];
    if (meanings.length === 0) {
      skipped.push({ key, reason: 'no meanings — nothing to accept as an answer' });
      continue;
    }

    valid.push({
      key: entry.key,
      meanings,
      ...(entry.exampleTranslations ? { exampleTranslations: entry.exampleTranslations } : {}),
    });
  }

  return { valid, skipped };
}
