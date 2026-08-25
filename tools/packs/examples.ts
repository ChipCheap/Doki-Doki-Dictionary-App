/**
 * S10, S11 — Tatoeba ingest and example assembly.
 *
 * Two preferred, more allowed, fewer accepted, and an entry is NEVER dropped for
 * having none. Only 13% of senses carry a Wiktionary example, so Tatoeba does
 * most of the work here and the pooling is load-bearing rather than a
 * refinement.
 *
 * Nothing is generated. A fabricated Vietnamese sentence with wrong tones is
 * exactly the error a learner cannot detect, which is why the framework allows
 * assembling and forbids authoring.
 *
 * Sentences are duplicated across entries rather than normalized into a shared
 * collection: normalizing needs to know which words a sentence contains, and
 * Vietnamese compounds mean whitespace does not split words. A wrong
 * sentence-to-word link is a silent defect; duplication costs a few MB.
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { CoreExample } from '../../src/dictionary/pack-format';
import { normalizeTerm } from './registry';

export const PREFERRED_EXAMPLES = 2;

export interface TatoebaSentence {
  id: string;
  text: string;
  translation?: string;
}

export interface TatoebaCorpus {
  /** Normalized token → sentence ids containing it. */
  byToken: Map<string, string[]>;
  byId: Map<string, TatoebaSentence>;
}

/** `id \t lang \t text` per line. */
async function readSentences(path: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const lines = createInterface({
    input: createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line) continue;
    const [id, , text] = line.split('\t');
    if (id && text) out.set(id, text);
  }
  return out;
}

/** `sentence_id \t translation_id` per line. */
async function readLinks(path: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const lines = createInterface({
    input: createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line) continue;
    const [from, to] = line.trim().split('\t');
    // Only the first translation is kept: several English renderings of one
    // sentence add bytes without adding teaching value.
    if (from && to && !out.has(from)) out.set(from, to);
  }
  return out;
}

/**
 * Index the corpus by the tokens its sentences contain.
 *
 * Whitespace tokenization, which is honest for Spanish and imperfect for
 * Vietnamese — a compound written as two words will only be found when the
 * lookup term is written the same way. The consequence is fewer Vietnamese
 * examples, which the coverage report shows, rather than wrong ones.
 */
export async function readTatoeba(
  sentencesPath: string,
  linksPath: string,
  englishPath: string,
  /**
   * form → lemma, from S3.
   *
   * Sentences contain inflected words; entries are keyed by lemma. Spanish
   * sentences say `hablo` and `habla`, never `hablar`, so indexing surface
   * forms alone found examples for barely half of Spanish entries while finding
   * them for two thirds of Vietnamese ones — not because Spanish has fewer
   * sentences (it has far more) but because Vietnamese is analytic and its
   * words appear in their base form. Indexing each token under its lemma too is
   * what makes the corpus reachable for an inflected language.
   */
  formMap?: ReadonlyMap<string, string>,
): Promise<TatoebaCorpus> {
  const sentences = await readSentences(sentencesPath);
  const links = await readLinks(linksPath);
  const english = await readSentences(englishPath);

  const byId = new Map<string, TatoebaSentence>();
  const byToken = new Map<string, string[]>();

  for (const [id, text] of sentences) {
    const translationId = links.get(id);
    const translation = translationId ? english.get(translationId) : undefined;

    // A sentence with no English translation cannot teach a meaning, so it is
    // indexed for nothing and skipped.
    if (!translation) continue;

    byId.set(id, { id, text, translation });

    const keys = new Set<string>();
    for (const token of tokenize(text)) {
      keys.add(token);
      const lemma = formMap?.get(token);
      if (lemma) keys.add(lemma);
    }

    for (const key of keys) {
      const list = byToken.get(key);
      if (list) {
        if (list.length < 200) list.push(id);
      } else {
        byToken.set(key, [id]);
      }
    }
  }

  return { byId, byToken };
}

export function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.split(/[^\p{L}\p{N}]+/u)) {
    const token = normalizeTerm(raw);
    if (token.length > 0) out.add(token);
  }
  return out;
}

/** A stable id for a Wiktionary example, which carries none of its own. */
function wiktionaryExampleId(text: string): string {
  return `wikt:${createHash('sha256').update(text).digest('hex').slice(0, 12)}`;
}

export interface AssembledExamples {
  core: CoreExample[];
  /** Keyed by example id, for the meaning layer. */
  translations: Record<string, string>;
}

/**
 * Pool Wiktionary's own examples with Tatoeba's, preferring the sourced ones
 * that already came attached to this exact sense.
 *
 * Wiktionary examples come first because they were chosen to illustrate this
 * sense, where a Tatoeba match only knows the word appears in the sentence —
 * for a polysemous word that may well be a different sense entirely.
 */
export function assembleExamples(
  term: string,
  wiktionary: readonly { text: string; translation?: string; ref?: string }[],
  corpus: TatoebaCorpus | undefined,
  /**
   * Whether this is the FIRST sense of its (term, POS).
   *
   * Tatoeba is searched by term, but entries are per sense, so a polysemous
   * word would otherwise give every sense the same sentences and at most one of
   * them would be right. Observed in a real build: `bàn` sense 2, "game; match",
   * was illustrated with "Place the deck of cards on the oaken table" — a
   * sentence about sense 1. A learner cannot diagnose that, which is exactly the
   * class of defect the framework rules out.
   *
   * Restricting corpus matches to the first sense leans on a decision the
   * framework already made: Wiktionary's editorial sense order stands in for the
   * sense frequency nobody has data for. Later senses keep whatever examples
   * Wiktionary attached to them directly, which are sense-specific by
   * construction.
   */
  isPrimarySense: boolean,
  limit = PREFERRED_EXAMPLES,
): AssembledExamples {
  const core: CoreExample[] = [];
  const translations: Record<string, string> = {};

  for (const example of wiktionary) {
    if (core.length >= limit) break;
    const id = wiktionaryExampleId(example.text);
    core.push({ id, text: example.text, source: example.ref ?? 'English Wiktionary' });
    if (example.translation) translations[id] = example.translation;
  }

  if (core.length < limit && corpus && isPrimarySense) {
    for (const id of corpus.byToken.get(normalizeTerm(term)) ?? []) {
      if (core.length >= limit) break;
      const sentence = corpus.byId.get(id);
      if (!sentence) continue;

      const exampleId = `tatoeba:${sentence.id}`;
      if (core.some((e) => e.id === exampleId)) continue;

      core.push({ id: exampleId, text: sentence.text, source: `Tatoeba #${sentence.id}` });
      if (sentence.translation) translations[exampleId] = sentence.translation;
    }
  }

  return { core, translations };
}
