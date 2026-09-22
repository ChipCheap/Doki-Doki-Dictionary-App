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

/**
 * English words that cannot say which sense a sentence uses: function words,
 * and the placeholders glosses are written with ("to do SOMETHING to SOMEONE").
 * Pronouns are here too, which means pronoun senses never win a sentence —
 * correctly, since "I" and "you" occur in nearly every translation and the
 * Vietnamese pronoun senses differ in who is speaking, which English cannot show.
 */
const GLOSS_STOPWORDS = new Set(
  (
    'a an the to of in on at for with by from into onto about as and or but nor ' +
    'be is are was were been being am have has had do does did done ' +
    'not no yes so than then that this these those which who whom whose what ' +
    'it its i me my you your he him his she her we us our they them their ' +
    'one ones someone somebody something anything anyone thing things person people ' +
    'up out off over very more most much many some any all also especially ' +
    'usually often etc used use such other another own same way kind sort'
  ).split(' '),
);

/**
 * A crude English stem: enough to meet "bored" with "to bore", "guns" with
 * "gun", "voting" with "to vote". Deliberately suffix-only — a wrong merge here
 * would route a sentence to the wrong sense, the very defect being fixed, so it
 * errs towards leaving words apart.
 */
function stem(word: string): string {
  let w = word;
  for (const suffix of ['ing', 'ied', 'ies', 'ed', 'es', 's', 'ly']) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3 && !w.endsWith('ss')) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w.endsWith('e') && w.length > 3 ? w.slice(0, -1) : w;
}

/** The bare minimum, for a gloss made entirely of stopwords. */
const MINIMAL_STOPWORDS = new Set(['a', 'an', 'the', 'to', 'of']);

/** Content stems of an English text. */
export function englishStems(text: string, stopwords: ReadonlySet<string> = GLOSS_STOPWORDS): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z]+/)) {
    if (raw.length < 2 || stopwords.has(raw)) continue;
    out.add(stem(raw));
  }
  return out;
}

/**
 * The stems a gloss is matched on. Parenthesised qualifiers are dropped first —
 * "India (a country in South Asia)" should not claim every sentence that
 * mentions a country — unless the whole gloss is a qualifier. A gloss that is
 * nothing BUT stopwords — `làm` "to do", `là` "to be" — keeps them: otherwise it
 * could never match a sentence, and would be banded down as if nobody used it.
 */
function glossStems(glosses: readonly string[]): Set<string> {
  const joined = glosses.join(' ');
  const bare = englishStems(joined.replace(/\([^)]*\)/g, ' '));
  if (bare.size > 0) return bare;
  const full = englishStems(joined);
  return full.size > 0 ? full : englishStems(joined, MINIMAL_STOPWORDS);
}

/**
 * Light verbs: in a longer gloss they carry almost none of the meaning. "He
 * stopped to make speeches" shares only "make" with `lại` "to make up for one's
 * disadvantage", and must not be routed there on that alone. They count half —
 * unless they are ALL the gloss has, as in `lại` "to come", where they are the
 * meaning.
 */
const LIGHT_VERBS = new Set(
  'make get take give put go come let keep set turn become bring hold run move cause'
    .split(' ')
    .map(stem),
);

/** A sentence must reach this score for a sense to win it. */
const MATCH_THRESHOLD = 1;

function matchScore(gloss: ReadonlySet<string>, sentence: ReadonlySet<string>): number {
  const onlyLight = [...gloss].every((s) => LIGHT_VERBS.has(s));
  let score = 0;
  for (const s of gloss) {
    if (sentence.has(s)) score += LIGHT_VERBS.has(s) && !onlyLight ? 0.5 : 1;
  }
  return score;
}

export interface RoutedSentences {
  /** Per sense, in input order: the corpus sentence ids given to that sense. */
  bySense: string[][];
  /**
   * Per sense: how many sentences its GLOSS actually matched. The usage
   * evidence for difficulty — unlike `bySense`, never inflated by the
   * dominant-sense fallback, which would otherwise count its own guesses.
   */
  matched: number[];
  /**
   * Sentences no sense could claim — none matched, and no sense dominated. A
   * missing example is permitted (Never-6); a wrong one is the silent defect
   * the framework rules out.
   */
  unrouted: number;
}

/**
 * The dominant-sense fallback applies when one sense won more than this share
 * of the matched sentences, and at least `DOMINANT_MIN` of them.
 */
const DOMINANT_SHARE = 0.5;
const DOMINANT_MIN = 2;

const translationStems = new WeakMap<TatoebaCorpus, Map<string, Set<string>>>();

/**
 * Decide which sense of a term each corpus sentence illustrates.
 *
 * Tatoeba is searched by term, but entries are per sense, so a sentence found
 * for `súng` is about EITHER the water lily or the gun — never both. This used
 * to be settled by giving every corpus sentence to the first sense, trusting
 * Wiktionary's sense order to put the common sense first. It does not: `súng`
 * is two etymologies and the water lily is listed first, so "He leveled his gun
 * at me" illustrated "water lily". Hundreds of entries had the same defect.
 *
 * Instead the sentence's ENGLISH TRANSLATION is compared with each sense's
 * gloss, and the sense sharing the most content words wins; a tie goes to the
 * earlier sense.
 *
 * A sentence matching NO gloss is the common case, not the rare one —
 * translations paraphrase: `lại` "to come" is found in "Mang lại đây!", "Bring
 * it here!". Leaving all of those out cost Vietnamese a fifth of its examples.
 * So when one sense clearly dominates the sentences that DID match, the
 * unmatched ones go to it: they are overwhelmingly likely to use the same
 * sense. With no dominant sense they stay out, since that is exactly the
 * situation in which the first-sense rule got `súng` wrong.
 *
 * `senses` must hold EVERY sense of the term, across parts of speech — `lại`
 * the adverb and `lại` the verb are found by the same sentences.
 */
export function routeSentences(
  senses: readonly (readonly string[])[],
  sentenceIds: readonly string[],
  corpus: TatoebaCorpus,
): RoutedSentences {
  const bySense = senses.map((): string[] => []);
  if (senses.length === 1) {
    bySense[0]!.push(...sentenceIds);
    return { bySense, matched: [sentenceIds.length], unrouted: 0 };
  }

  let cache = translationStems.get(corpus);
  if (!cache) {
    cache = new Map();
    translationStems.set(corpus, cache);
  }

  const glossSets = senses.map(glossStems);
  const unmatched: string[] = [];

  for (const id of sentenceIds) {
    let stems = cache.get(id);
    if (!stems) {
      // The sentence keeps its function words; only the GLOSS side filters.
      // Stripping "do" here would leave `làm` "to do" nothing to ever match.
      stems = englishStems(corpus.byId.get(id)?.translation ?? '', MINIMAL_STOPWORDS);
      cache.set(id, stems);
    }

    // A tie goes to the EARLIER sense. Leaving ties out was tried: `ăn` "to eat"
    // and "to eat with (a utensil)" both reduce to "eat", so every eating
    // sentence tied, "to eat" matched almost nothing, and was banded as if
    // unused. Wiktionary lists the plain sense before its refinements.
    let best = 0;
    let winner = -1;
    glossSets.forEach((gloss, index) => {
      const score = matchScore(gloss, stems!);
      if (score >= MATCH_THRESHOLD && score > best) {
        best = score;
        winner = index;
      }
    });

    if (winner < 0) unmatched.push(id);
    else bySense[winner]!.push(id);
  }

  const matched = bySense.map((won) => won.length);
  const total = matched.reduce((sum, n) => sum + n, 0);
  const top = Math.max(...matched);
  const dominant = matched.indexOf(top);
  if (top >= DOMINANT_MIN && top > total * DOMINANT_SHARE) {
    bySense[dominant]!.push(...unmatched);
    return { bySense, matched, unrouted: 0 };
  }

  return { bySense, matched, unrouted: unmatched.length };
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
  wiktionary: readonly { text: string; translation?: string; ref?: string }[],
  corpus: TatoebaCorpus | undefined,
  /**
   * The corpus sentences `routeSentences` gave THIS sense.
   *
   * Never the term's whole match list: a polysemous word would give every
   * sense the same sentences, and at most one of them would be right. Observed
   * in real builds: `bàn` "game; match" illustrated with a sentence about a
   * table, `súng` "water lily" with two about guns.
   */
  corpusIds: readonly string[],
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

  if (core.length < limit && corpus) {
    for (const id of corpusIds) {
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
