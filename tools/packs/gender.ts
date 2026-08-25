/**
 * S7 — grammatical gender and the article override.
 *
 * Gender is SOURCED, never inferred. Wiktionary tags nouns in the same
 * `senses[].tags` array the register labels come from — confirmed against the
 * real extract, where every `banco` noun sense carries `tags: ["masculine"]`.
 *
 * Inferring from word endings is the tempting shortcut and it is wrong often
 * enough to matter: Spanish `el agua`, `el problema`, `la mano` all break the
 * -a/-o rule, and the article is part of the typed answer, so a wrong guess
 * marks a correct learner wrong.
 */

import type { Gender } from '../../src/domain/articles';
import type { SenseCandidate } from './kaikki';

const TAG_TO_GENDER: Readonly<Record<string, Gender>> = Object.freeze({
  masculine: 'm',
  feminine: 'f',
  neuter: 'n',
});

/**
 * Read gender from a sense's tags.
 *
 * A sense tagged both masculine and feminine — `el/la mar` — becomes `mf`
 * rather than picking one, since both articles are correct.
 */
export function genderOf(sense: SenseCandidate): Gender | undefined {
  const found = new Set<Gender>();
  for (const tag of sense.tags) {
    const gender = TAG_TO_GENDER[tag];
    if (gender) found.add(gender);
  }

  if (found.size === 0) return undefined;
  if (found.size > 1) return 'mf';
  return [...found][0];
}

/**
 * Words whose article does not follow from their gender.
 *
 * Spanish takes `el` before a stressed /a/ even when the noun is feminine, so
 * `el agua` and `el hacha` are correct and `la agua` is not. This is a small
 * closed set per language rather than a rule, because the rule needs stress
 * placement that the source does not carry.
 *
 * The framework notes this varies sharply by language — essentially never in
 * German, a small set in Spanish, frequently in French and Italian. A language
 * that needed it pervasively would want a different mechanism than a list.
 */
const ARTICLE_OVERRIDES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({
    es: Object.freeze({
      agua: 'el',
      águila: 'el',
      alma: 'el',
      arma: 'el',
      aula: 'el',
      ave: 'el',
      hacha: 'el',
      hambre: 'el',
      área: 'el',
    }),
  });

export function articleOverrideFor(
  language: string,
  term: string,
  gender: Gender | undefined,
): string | undefined {
  // Only meaningful where an article would otherwise be derived from gender.
  if (!gender) return undefined;
  return ARTICLE_OVERRIDES[language]?.[term.normalize('NFC').toLowerCase()];
}
