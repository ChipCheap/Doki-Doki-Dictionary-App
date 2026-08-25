/**
 * S1 — source declaration, fetching and pinning.
 *
 * Every input is pinned. A build reads only from the `dumps/` cache and nothing
 * reaches the network mid-build, so a pack is reproducible from
 * `sources.lock.json` and a Wiktionary edit cannot change a pack we did not
 * intend to rebuild.
 *
 * Sizes are real, measured on 2026-08-23: the Spanish kaikki extract is 978 MB,
 * Vietnamese 75 MB. `dumps/` is gitignored for that reason.
 */

import { createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';

export type SourceId =
  | 'kaikki'
  | 'tatoeba-sentences'
  | 'tatoeba-links'
  | 'tatoeba-english'
  | 'frequency';

export interface SourceSpec {
  id: SourceId;
  url: string;
  /** Relative to `dumps/`. */
  file: string;
  licence: string;
  attribution: string;
  /** bzip2 is Tatoeba's only export format; Node's zlib cannot read it. */
  compression?: 'bz2';
  /**
   * `plain` is `word count` per line. `lemma-csv` is already lemmatized and
   * POS-tagged, which removes the folding step entirely — see `frequency.ts`.
   */
  format?: 'plain' | 'lemma-csv';
}

export interface LanguageSources {
  language: string;
  /** kaikki's directory name — the English name of the language. */
  kaikkiName: string;
  /** Tatoeba's ISO 639-3 code. */
  tatoebaCode: string;
  sources: SourceSpec[];
}

export const DUMPS_DIR = 'dumps';
export const LOCK_FILE = 'sources.lock.json';

interface FrequencySpec {
  url: string;
  licence: string;
  attribution: string;
  format: 'plain' | 'lemma-csv';
}

function specsFor(
  language: string,
  kaikkiName: string,
  tatoebaCode: string,
  frequency: FrequencySpec,
): LanguageSources {
  return {
    language,
    kaikkiName,
    tatoebaCode,
    sources: [
      {
        id: 'kaikki',
        url: `https://kaikki.org/dictionary/${kaikkiName}/kaikki.org-dictionary-${kaikkiName}.jsonl`,
        file: `${language}-kaikki.jsonl`,
        licence: 'CC BY-SA 4.0 (and GFDL)',
        attribution: 'English Wiktionary, extracted by wiktextract via kaikki.org',
      },
      {
        id: 'tatoeba-sentences',
        url: `https://downloads.tatoeba.org/exports/per_language/${tatoebaCode}/${tatoebaCode}_sentences.tsv.bz2`,
        file: `${language}-sentences.tsv`,
        licence: 'CC BY 2.0 FR',
        attribution: 'Tatoeba Project',
        compression: 'bz2',
      },
      {
        id: 'tatoeba-links',
        url: `https://downloads.tatoeba.org/exports/per_language/${tatoebaCode}/${tatoebaCode}-eng_links.tsv.bz2`,
        file: `${language}-links.tsv`,
        licence: 'CC BY 2.0 FR',
        attribution: 'Tatoeba Project',
        compression: 'bz2',
      },
      {
        // Shared across every language: the links file gives translation IDs,
        // not text, so the English corpus is what turns a link into a sentence.
        // The filename is language-independent so it is downloaded once.
        id: 'tatoeba-english',
        url: 'https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2',
        file: 'eng-sentences.tsv',
        licence: 'CC BY 2.0 FR',
        attribution: 'Tatoeba Project',
        compression: 'bz2',
      },
      {
        id: 'frequency',
        url: frequency.url,
        file: `${language}-frequency.${frequency.format === 'lemma-csv' ? 'csv' : 'txt'}`,
        licence: frequency.licence,
        attribution: frequency.attribution,
        format: frequency.format,
      },
    ],
  };
}

export const LANGUAGES: Readonly<Record<string, LanguageSources>> = Object.freeze({
  /**
   * Spanish uses a LEMMATIZED list. Folding inflections by hand was the source
   * of every ranking defect this pipeline has had: `casa` donated its count to
   * `casar` and fell to rank 29,660, while `puede` and `esta` arrived as
   * vocabulary because they carry marginal standalone senses. A list that is
   * already lemma-keyed removes the transformation instead of correcting it.
   */
  es: specsFor('es', 'Spanish', 'spa', {
    url: 'https://raw.githubusercontent.com/doozan/spanish_data/master/frequency.csv',
    licence: 'CC BY 4.0',
    attribution: 'doozan/spanish_data, lemmatized from hermitdave/FrequencyWords (OpenSubtitles)',
    format: 'lemma-csv',
  }),
  /**
   * Vietnamese has no equivalent under a licence we can use, so it keeps the
   * syllable-token list and recovers compounds by segmentation — see
   * `segment.ts`. Spaces mark syllables, not words, so this list alone reaches
   * almost none of the polysyllabic vocabulary.
   */
  vi: specsFor('vi', 'Vietnamese', 'vie', {
    url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/vi/vi_full.txt',
    licence: 'CC BY-SA 4.0',
    attribution: 'hermitdave/FrequencyWords, derived from OpenSubtitles',
    format: 'plain',
  }),
});

export interface LockedSource {
  id: SourceId;
  url: string;
  file: string;
  bytes: number;
  sha256: string;
  fetchedAt: string;
}

export type Lock = Record<string, LockedSource[]>;

export async function readLock(root: string): Promise<Lock> {
  try {
    return JSON.parse(await readFile(join(root, LOCK_FILE), 'utf8')) as Lock;
  } catch {
    return {};
  }
}

export async function writeLock(root: string, lock: Lock): Promise<void> {
  await writeFile(join(root, LOCK_FILE), `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  const { createReadStream } = await import('node:fs');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

async function download(spec: SourceSpec, target: string): Promise<void> {
  const response = await fetch(spec.url);
  if (!response.ok || !response.body) {
    throw new Error(`${spec.id}: ${spec.url} returned ${response.status}`);
  }

  const body = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);

  if (spec.compression === 'bz2') {
    // Tatoeba publishes per-language exports only as bzip2 — the plain and
    // gzip variants both 404 — and Node's zlib has no bzip2, hence the one
    // decompression dependency in this pipeline.
    const { default: bz2 } = await import('unbzip2-stream');
    await pipeline(body, bz2(), createWriteStream(target));
    return;
  }

  await pipeline(body, createWriteStream(target));
}

export interface FetchReport {
  id: SourceId;
  file: string;
  bytes: number;
  cached: boolean;
}

/**
 * Fetch what is missing and record what was taken.
 *
 * Existing files are left alone unless `refresh` is set: these are hundreds of
 * megabytes, and re-downloading them by accident would be slow enough to
 * discourage rebuilding at all.
 */
export async function fetchSources(
  root: string,
  language: string,
  refresh = false,
): Promise<FetchReport[]> {
  const spec = LANGUAGES[language];
  if (!spec) throw new Error(`Unknown language "${language}". Known: ${Object.keys(LANGUAGES).join(', ')}`);

  const dir = join(root, DUMPS_DIR);
  await mkdir(dir, { recursive: true });

  const lock = await readLock(root);
  const locked: LockedSource[] = [];
  const report: FetchReport[] = [];

  for (const source of spec.sources) {
    const target = join(dir, source.file);
    let cached = false;

    try {
      await stat(target);
      cached = !refresh;
    } catch {
      cached = false;
    }

    if (!cached) await download(source, target);

    const { size } = await stat(target);
    locked.push({
      id: source.id,
      url: source.url,
      file: source.file,
      bytes: size,
      sha256: await sha256(target),
      fetchedAt: new Date().toISOString(),
    });
    report.push({ id: source.id, file: source.file, bytes: size, cached });
  }

  lock[language] = locked;
  await writeLock(root, lock);
  return report;
}

/** Where a build reads a source from, once fetched. */
export function sourcePath(root: string, language: string, id: SourceId): string {
  const spec = LANGUAGES[language];
  const source = spec?.sources.find((s) => s.id === id);
  if (!source) throw new Error(`No source ${id} for ${language}`);
  return join(root, DUMPS_DIR, source.file);
}

/**
 * Refuse to build against a cache that does not match the lock.
 *
 * Reproducibility is only real if the build checks; otherwise a half-refreshed
 * `dumps/` silently produces a pack nobody can rebuild.
 */
export async function verifyAgainstLock(root: string, language: string): Promise<void> {
  const lock = await readLock(root);
  const locked = lock[language];
  if (!locked) {
    throw new Error(`No lock entry for "${language}". Run: npm run packs:fetch ${language}`);
  }

  for (const entry of locked) {
    const path = join(root, DUMPS_DIR, entry.file);
    let size: number;
    try {
      ({ size } = await stat(path));
    } catch {
      throw new Error(`Missing ${entry.file}. Run: npm run packs:fetch ${language}`);
    }
    if (size !== entry.bytes) {
      throw new Error(
        `${entry.file} is ${size} bytes but the lock records ${entry.bytes}. ` +
          `Re-fetch with --refresh, or restore the pinned copy.`,
      );
    }
  }
}
