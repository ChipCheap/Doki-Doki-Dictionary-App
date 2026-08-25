/**
 * S2 — reading kaikki's Wiktionary extraction.
 *
 * One JSON object per line, one per (word, part of speech), each carrying a
 * `senses` array. The Spanish extract is ~978 MB, so it is streamed line by
 * line and never parsed whole.
 *
 * Field shapes here were confirmed against the real extract rather than assumed:
 * gender arrives inside `senses[].tags` alongside register labels, `topics` is
 * present on only ~10% of senses, and ~21% of senses are inflections marked with
 * `form_of`.
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

/** Only the fields this pipeline reads. The extract carries far more. */
export interface KaikkiSense {
  glosses?: string[];
  raw_glosses?: string[];
  tags?: string[];
  topics?: string[];
  categories?: ({ name?: string } | string)[];
  examples?: { text?: string; english?: string; ref?: string; type?: string }[];
  form_of?: { word?: string }[];
}

export interface KaikkiEntry {
  word?: string;
  pos?: string;
  lang_code?: string;
  senses?: KaikkiSense[];
  forms?: { form?: string; tags?: string[] }[];
}

/** One studiable sense, flattened out of its entry. */
export interface SenseCandidate {
  language: string;
  term: string;
  partOfSpeech: string;
  glosses: string[];
  /** Register and grammatical labels — `masculine`, `archaic`, `colloquial`. */
  tags: string[];
  topics: string[];
  examples: { text: string; translation?: string; ref?: string }[];
  /** Position in the source's own sense order, the cap's final tie-breaker. */
  sourceIndex: number;
}

/** An inflection pointing at its lemma. Not vocabulary; feeds S3. */
export interface FormLink {
  form: string;
  lemma: string;
}

export interface ReadResult {
  candidates: SenseCandidate[];
  formLinks: FormLink[];
  /** Senses dropped for having no usable gloss, for the source-coverage report. */
  glosslessSenses: number;
}

export function isFormOf(sense: KaikkiSense): boolean {
  return Boolean(sense.form_of?.length) || (sense.tags ?? []).includes('form-of');
}

/**
 * A cross-reference rather than a definition.
 *
 * Wiktionary marks these `alt-of`: `esta` is "alternative spelling of ésta",
 * `hay` is "alternative form of ahí". They carry no meaning of their own and
 * are not `form-of`, so they slipped through and became pack entries — teaching
 * a learner `esta` as vocabulary when it is a spelling note.
 */
export function isAlternativeOf(sense: KaikkiSense): boolean {
  return (sense.tags ?? []).includes('alt-of');
}

/**
 * Senses that cannot be current vocabulary whatever their rank.
 *
 * These inherit the frequency of a homographic inflection: `buena` ranks 215
 * because it is the feminine of `bueno`, but its only standalone sense is an
 * OBSOLETE noun meaning "inheritance". Without this, that obsolete noun lands
 * in the pack tagged `basic`.
 */
const DEAD_LABELS = ['obsolete', 'archaic'];

export function isDeadSense(sense: KaikkiSense): boolean {
  return (sense.tags ?? []).some((t) => DEAD_LABELS.includes(t));
}

/**
 * Parts of speech that are grammar rather than vocabulary.
 *
 * `del` and `al` rank 40 and 43 — they are contractions of preposition plus
 * article. Real Spanish, but nothing a vocabulary card can teach in isolation.
 * Romanizations are the Vietnamese equivalent: character readings, not words.
 */
const EXCLUDED_POS = new Set([
  'contraction',
  // Sino-Vietnamese readings of Chinese characters — "sino-vietnamese reading
  // of 亞". A pronunciation note for a character the learner never sees, not a
  // Vietnamese word. 546 of these sit in the Vietnamese extract.
  'romanization',
]);

/**
 * `raw_glosses` keeps the label prefix — "(finance) a bank" — while `glosses`
 * has it stripped. The stripped form is what a learner should see and what the
 * registry should match on, so labels never leak into an answer.
 */
function glossesOf(sense: KaikkiSense): string[] {
  const glosses = sense.glosses ?? sense.raw_glosses ?? [];
  return glosses.filter((g) => typeof g === 'string' && g.trim().length > 0);
}

/** Stream one language's extract, yielding studiable senses and form links. */
export async function readKaikki(
  path: string,
  language: string,
): Promise<ReadResult> {
  const candidates: SenseCandidate[] = [];
  const formLinks: FormLink[] = [];
  let glosslessSenses = 0;

  const lines = createInterface({
    input: createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (line.length === 0) continue;

    let entry: KaikkiEntry;
    try {
      entry = JSON.parse(line) as KaikkiEntry;
    } catch {
      // A truncated final line is expected when reading a partial download;
      // a malformed line mid-file would be a source defect worth failing on,
      // but the two are indistinguishable here, so skip and let the
      // source-coverage report show the shortfall.
      continue;
    }

    const term = entry.word;
    const partOfSpeech = entry.pos;
    if (!term || !partOfSpeech) continue;
    if (EXCLUDED_POS.has(partOfSpeech)) continue;
    if (entry.lang_code && entry.lang_code !== language) continue;

    entry.senses?.forEach((sense, sourceIndex) => {
      if (isFormOf(sense)) {
        // An inflection is not vocabulary — "first-person singular present
        // indicative of bancar" is nothing to study — but it is exactly what
        // folds subtitle counts onto the lemma.
        for (const target of sense.form_of ?? []) {
          if (target.word) formLinks.push({ form: term, lemma: target.word });
        }
        return;
      }

      if (isAlternativeOf(sense) || isDeadSense(sense)) return;

      const glosses = glossesOf(sense);
      if (glosses.length === 0) {
        glosslessSenses += 1;
        return;
      }

      candidates.push({
        language,
        term,
        partOfSpeech,
        glosses,
        tags: sense.tags ?? [],
        topics: sense.topics ?? [],
        examples: (sense.examples ?? [])
          .filter((e) => typeof e.text === 'string' && e.text.trim().length > 0)
          .map((e) => ({
            text: e.text!.trim(),
            ...(e.english ? { translation: e.english } : {}),
            ...(e.ref ? { ref: e.ref } : {}),
          })),
        sourceIndex,
      });
    });

    // The lemma's own inflection table is the other direction of the same map,
    // and it covers forms that never got their own entry.
    for (const form of entry.forms ?? []) {
      if (form.form && form.form !== term && !(form.tags ?? []).includes('romanization')) {
        formLinks.push({ form: form.form, lemma: term });
      }
    }
  }

  return { candidates, formLinks, glosslessSenses };
}
