/**
 * Grammatical gender and its definite article.
 *
 * Gender is a property of the WORD, so it lives on the entry; the article is
 * derived per language, because `m` means `el` in Spanish and `der` in German.
 * Keeping the mapping here rather than on every entry means adding a language
 * is one line, not a pass over the whole pack.
 *
 * Entries split per sense, so the awkward cases are already separate rows —
 * Spanish `el capital` (money) and `la capital` (city) are two entries, each
 * with one gender, and the ambiguity never has to be modelled.
 */

/** `mf` is a word that genuinely takes either, e.g. Spanish `el/la mar`. */
export type Gender = 'm' | 'f' | 'n' | 'mf';

export const GENDERS: readonly Gender[] = Object.freeze(['m', 'f', 'n', 'mf']);

export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && (GENDERS as readonly string[]).includes(value);
}

/**
 * Definite articles by language and gender. Nominative singular only — German
 * articles decline (`der/den/dem/des`), and a case system is a much larger
 * feature than this one.
 */
const ARTICLES: Readonly<Record<string, Partial<Record<Gender, readonly string[]>>>> =
  Object.freeze({
    es: { m: ['el'], f: ['la'], mf: ['el', 'la'] },
    fr: { m: ['le'], f: ['la'], mf: ['le', 'la'] },
    de: { m: ['der'], f: ['die'], n: ['das'] },
    it: { m: ['il'], f: ['la'], mf: ['il', 'la'] },
    pt: { m: ['o'], f: ['a'], mf: ['o', 'a'] },
  });

export function languageUsesGender(language: string): boolean {
  return ARTICLES[language] !== undefined;
}

/**
 * The articles a word accepts.
 *
 * `override` wins over the gender rule, for words whose article does not follow
 * from their gender — Spanish `el agua` is feminine but takes `el` before a
 * stressed /a/, and French elides to `l'`. Without the override the seed pack
 * would already be wrong.
 */
export function articlesFor(
  language: string,
  gender: Gender | undefined,
  override?: string,
): readonly string[] {
  if (override) return [override];
  if (!gender) return [];
  return ARTICLES[language]?.[gender] ?? [];
}

/** How the word is shown: `el libro`, `el/la mar`, or just the word. */
export function displayWithArticle(
  language: string,
  term: string,
  gender?: Gender,
  override?: string,
): string {
  const articles = articlesFor(language, gender, override);
  if (articles.length === 0) return term;
  return `${articles.join('/')} ${term}`;
}

/**
 * Every form accepted as a typed answer.
 *
 * The article is part of the answer, so `la libro` is wrong and a bare `libro`
 * is wrong too. That is deliberate — gender is the thing being learned — and
 * *Redo question* already exists for when the user judges it close enough.
 */
export function acceptedFormsWithArticle(
  language: string,
  term: string,
  gender?: Gender,
  override?: string,
): string[] {
  const articles = articlesFor(language, gender, override);
  if (articles.length === 0) return [term];
  return articles.map((article) => `${article} ${term}`);
}
