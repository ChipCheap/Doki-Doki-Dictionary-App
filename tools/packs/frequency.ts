/**
 * S3 — frequency lists and folding inflections onto their lemma.
 *
 * The OpenSubtitles-derived lists are raw subtitle tokens: `casa` and `casas`
 * are counted separately, as are every conjugation of a verb. Ranking on those
 * counts systematically under-ranks exactly the common nouns and verbs that
 * belong in `Basic` — a verb's frequency is spread across a dozen forms while
 * an uninflected adverb keeps all of its own — and that error would propagate
 * into the difficulty tier of every quick-created deck.
 *
 * kaikki's `form_of` links and lemma inflection tables are what make the fold
 * possible without a morphological analyser.
 */

import { readFile } from 'node:fs/promises';
import type { FormLink } from './kaikki';
import { normalizeTerm } from './registry';

export interface FrequencyEntry {
  term: string;
  count: number;
}

/**
 * Parse a `word count` per line list.
 *
 * Malformed lines are skipped rather than failing the build: these lists are
 * derived from subtitle text and carry occasional junk, and one bad line should
 * not cost a whole language its ranking.
 */
export function parseFrequencyList(text: string): FrequencyEntry[] {
  const out: FrequencyEntry[] = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [term, raw] = line.trim().split(/\s+/);
    const count = Number(raw);
    if (!term || !Number.isFinite(count)) continue;
    out.push({ term: normalizeTerm(term), count });
  }

  return out;
}

/**
 * Parse an already-lemmatized, POS-tagged list.
 *
 * `count,spanish,pos,flags,usage` — one row per LEMMA, with the surface forms
 * that contributed listed in `usage`. Nothing needs folding: `ser` arrives as a
 * single row absorbing a hundred conjugations, and `puede` and `esta` do not
 * appear at all because they were folded upstream.
 *
 * Proper nouns and contractions are dropped here. They rank highly in subtitles
 * — `del` at 26 — and neither is vocabulary a card can teach.
 */
export function parseLemmaCsv(text: string): FrequencyEntry[] {
  const out: FrequencyEntry[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const fields = line.split(',');
    const count = Number(fields[0]);
    const term = (fields[1] ?? '').trim();
    const pos = (fields[2] ?? '').trim();

    if (!term || !Number.isFinite(count)) continue;
    if (pos === 'prop' || pos === 'contraction') continue;

    out.push({ term: normalizeTerm(term), count });
  }

  return out;
}

export async function readFrequencyList(
  path: string,
  format: 'plain' | 'lemma-csv' = 'plain',
): Promise<FrequencyEntry[]> {
  const text = await readFile(path, 'utf8');
  return format === 'lemma-csv' ? parseLemmaCsv(text) : parseFrequencyList(text);
}

/** Rank entries directly, for a list that needs no folding. */
export function rankDirectly(entries: readonly FrequencyEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.term, Math.max(totals.get(entry.term) ?? 0, entry.count));
  }

  const ranked = [...totals.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );

  const ranks = new Map<string, number>();
  ranked.forEach(([term], index) => ranks.set(term, index + 1));
  return ranks;
}

/**
 * Collapse the form links into one form → lemma map.
 *
 * A form claimed by several lemmas is left unmapped: `es:cero` could be a noun
 * or a verb form, and guessing would move a real word's count onto the wrong
 * lemma. Unmapped forms keep their own count, so nothing is lost — the word is
 * simply ranked on its own.
 */
export function buildFormMap(
  links: readonly FormLink[],
  /**
   * Terms that are lemmas in their own right.
   *
   * A word that is BOTH a lemma and an inflection of something else must keep
   * its own count. Spanish is full of deverbal nouns homographic with verb
   * forms, and folding them away is catastrophic: `casa` (house, rank 91) is
   * also a form of `casar` (to marry), and donating its count dropped it to
   * rank 29,660 — out of the pack entirely. Likewise `trabajo`, `cambio`,
   * `banco`.
   *
   * This under-counts the verb, which is the recoverable direction: a verb
   * ranked slightly too low still ships, where a noun ranked 29,660 does not
   * exist as far as the learner is concerned.
   */
  lemmaTerms?: ReadonlySet<string>,
): Map<string, string> {
  const claims = new Map<string, Set<string>>();

  for (const link of links) {
    const form = normalizeTerm(link.form);
    const lemma = normalizeTerm(link.lemma);
    if (form === lemma) continue;
    if (lemmaTerms?.has(form)) continue;

    const set = claims.get(form) ?? new Set<string>();
    set.add(lemma);
    claims.set(form, set);
  }

  const map = new Map<string, string>();
  for (const [form, lemmas] of claims) {
    if (lemmas.size === 1) map.set(form, [...lemmas][0]!);
  }
  return map;
}

/**
 * Fold each form's count into its lemma and rank the result.
 *
 * Rank 1 is the most frequent lemma. A word absent from the list gets no rank
 * at all rather than a bad one — S4 treats that as unranked rather than rare.
 */
export function foldToLemmas(
  entries: readonly FrequencyEntry[],
  formMap: ReadonlyMap<string, string>,
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    const lemma = formMap.get(entry.term) ?? entry.term;
    totals.set(lemma, (totals.get(lemma) ?? 0) + entry.count);
  }

  const ranked = [...totals.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );

  const ranks = new Map<string, number>();
  ranked.forEach(([lemma], index) => ranks.set(lemma, index + 1));
  return ranks;
}
