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
import { normalizeTerm } from './registry';

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
  // Single letters — "A", the letter. Nothing to translate.
  'character',
]);

/**
 * Which proper names are vocabulary.
 *
 * The frequency lists rank SPELLINGS, so names riding on a common word's
 * spelling were selected with it: `Sociedad` "a town in Morazán department, El
 * Salvador", `Acero` the surname, `Cometa` the reindeer — each shown with an
 * article it never takes. About 250 per language.
 *
 * A keep-list of countries was tried first and failed the other way: Wiktionary
 * files `mặt trời` (the sun), `trái đất` (the earth) and `tiếng Đức` (German)
 * ONLY as proper names, and gives `Trung Quốc` just "China" with no country
 * category. So the decision has two stages:
 *
 * 1. `nameVerdict`, per sense: drop what is never vocabulary — people,
 *    spellings, scientific names, acronyms — and note whether the sense is a
 *    MAJOR name (country, continent, national capital, language, sun/moon/earth)
 *    or a minor place.
 * 2. `keepNames`, once every sense is read: a name spelled like an ordinary
 *    word in the extract (`Cometa` beside `cometa`) is a homograph that only got
 *    in on that word's frequency, so it stays only if major. Other names stay
 *    unless they are a minor place.
 */
const PERSON_GLOSS = /\b(surname|given name|male name|female name|unisex name|home name|diminutive|nickname|patronymic)\b/i;
const PERSON_CATEGORY = /\b(surnames|given names|home names)\b/i;

/** "Traditional tone placement spelling of Hoà" — a spelling, not a word. */
const SPELLING_GLOSS = /\bspelling of\b/i;
const SPELLING_CATEGORY = /\b(alternative spellings|tone placement spellings|obsolete forms)\b/i;

/**
 * Scientific names. Wiktionary gives `Người` the proper-noun sense "Hominidae"
 * and `Chim` "Aves"; the everyday nouns person and bird are separate entries,
 * and learning `người` as "Hominidae" would be actively wrong.
 */
const TAXON_GLOSS =
  /^(?:[A-Z][a-z]+(?:idae|inae|aceae|ales|formes|oidea)|Aves|Mammalia|Reptilia|Amphibia|Insecta|Pisces|Animalia|Plantae|Fungi)$/;

/** "a town in …", "(a province of …)", "an island between …". */
const MINOR_PLACE_GLOSS =
  /(?:^|\()(?:a|an|the)\s+(?:[\w-]+\s+){0,2}?(?:town|village|commune|municipality|district|department|parish|county|barrio|neighbou?rhood|river|mountain|island|province|region|state|city|ward|canton|suburb|locality)\b|\bhighway\b/i;
const MINOR_PLACE_CATEGORY =
  /^(towns|villages|communes|municipalities|districts|departments|barrios|neighbou?rhoods|parishes|counties|rivers|mountains|islands|provinces|regions|states|cities|wards|localities|places)\b/i;

/**
 * "(a country in …)", "(the largest continent …)". The few words allowed between
 * the article and the noun stop "(a state of Australia, … of the country)" from
 * qualifying.
 */
const COUNTRY_GLOSS = /\((?:a|an|the)(?:\s+[\w-]+){0,3}?\s+(?:country|continent)\b/i;
const LANGUAGE_GLOSS = /^[\p{L}-]+(?:\s[\p{L}-]+)?\s+language$/iu;
const CELESTIAL_GLOSS = /^(?:the\s+)?(?:sun|moon|earth|earth's moon)$/i;
const MAJOR_CATEGORY = /^(countries|continents|official names of countries|languages)\b/i;
const CAPITAL_GLOSS = /\bthe capital (?:city )?of\b/i;
const CAPITAL_CATEGORY = /^national capitals\b/i;

/**
 * "Vietnam (a country …); Việt" → ["vietnam", "việt"]: the names a gloss gives.
 * Split on semicolons only — a comma is as likely to be "a town in Morazán
 * department, El Salvador", and "El Salvador" must not make that town a country.
 */
function bareNames(glosses: readonly string[]): string[] {
  return glosses
    .flatMap((g) => g.replace(/\([^)]*\)/g, ' ').split(';'))
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

function categoryNames(sense: KaikkiSense): string[] {
  return (sense.categories ?? [])
    .map((c) => (typeof c === 'string' ? c : c.name))
    .filter((c): c is string => typeof c === 'string');
}

export type NameVerdict = 'drop' | 'major' | 'capital' | 'minor-place' | 'other';

export function nameVerdict(term: string, glosses: readonly string[], sense: KaikkiSense): NameVerdict {
  const gloss = glosses.join(' ; ');
  const categories = categoryNames(sense);

  if (PERSON_GLOSS.test(gloss) || categories.some((c) => PERSON_CATEGORY.test(c))) return 'drop';
  if (SPELLING_GLOSS.test(gloss) || categories.some((c) => SPELLING_CATEGORY.test(c))) return 'drop';
  if (glosses.some((g) => TAXON_GLOSS.test(g.trim()))) return 'drop';
  // AVE, CHICO: acronyms of companies and bodies, not words.
  if (term.length > 1 && term === term.toUpperCase() && /\p{Lu}/u.test(term)) return 'drop';

  if (
    COUNTRY_GLOSS.test(gloss) ||
    glosses.some((g) => LANGUAGE_GLOSS.test(g.trim()) || CELESTIAL_GLOSS.test(g.trim())) ||
    categories.some((c) => MAJOR_CATEGORY.test(c))
  ) {
    return 'major';
  }
  if (CAPITAL_GLOSS.test(gloss) || categories.some((c) => CAPITAL_CATEGORY.test(c))) return 'capital';

  const minor =
    glosses.some((g) => MINOR_PLACE_GLOSS.test(g)) ||
    categories.some((c) => MINOR_PLACE_CATEGORY.test(c));
  return minor ? 'minor-place' : 'other';
}

/**
 * Stage 2, over the whole extract. `names` pairs each surviving name candidate
 * with its stage-1 verdict.
 */
export function keepNames(
  candidates: readonly SenseCandidate[],
  names: ReadonlyMap<SenseCandidate, NameVerdict>,
): SenseCandidate[] {
  const ordinaryTerms = new Set(
    candidates.filter((c) => c.partOfSpeech !== 'name').map((c) => normalizeTerm(c.term)),
  );
  // English names some sense has shown to be a country, continent or language
  // — how `Trung Quốc` "China" is recognised, via `Trung Hoa` "China" in
  // Countries in Asia.
  const majorNames = new Set<string>();
  for (const [candidate, verdict] of names) {
    if (verdict === 'major') for (const n of bareNames(candidate.glosses)) majorNames.add(n);
  }

  return candidates.filter((c) => {
    const verdict = names.get(c);
    if (verdict === undefined) return true;
    if (verdict === 'major') return true;
    // A minor place is never rescued by a country its gloss happens to name.
    if (verdict === 'minor-place') return false;
    if (bareNames(c.glosses).some((n) => majorNames.has(n))) return true;
    // Capitals and everything else survive only on their own spelling: Hanoi
    // and London do; `Victoria` — a capital, but also `victoria` — does not.
    return !ordinaryTerms.has(normalizeTerm(c.term));
  });
}

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
  const names = new Map<SenseCandidate, NameVerdict>();
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
      const verdict = partOfSpeech === 'name' ? nameVerdict(term, glosses, sense) : undefined;
      if (verdict === 'drop') return;

      const candidate: SenseCandidate = {
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
      };
      candidates.push(candidate);
      if (verdict) names.set(candidate, verdict);
    });

    // The lemma's own inflection table is the other direction of the same map,
    // and it covers forms that never got their own entry.
    for (const form of entry.forms ?? []) {
      if (form.form && form.form !== term && !(form.tags ?? []).includes('romanization')) {
        formLinks.push({ form: form.form, lemma: term });
      }
    }
  }

  return { candidates: keepNames(candidates, names), formLinks, glosslessSenses };
}
