/**
 * S4 — answer matching.
 *
 * framework.md: matching is trimmed, case-insensitive, and **accent- and
 * tone-sensitive**. `si` does not match `sí`. That sensitivity is the whole
 * point for Vietnamese, where tone marks carry meaning — so normalization must
 * never strip them.
 */

/** Trim and case-fold. Diacritics are deliberately preserved. */
export function normalize(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function isBlank(input: string): boolean {
  return normalize(input).length === 0;
}

/**
 * Reduce a string to its bare letters, for the "did they only miss the accents?"
 * check — never for matching.
 *
 * NFD decomposition plus combining-mark removal handles Spanish and most of
 * Vietnamese, but `đ` (U+0111) has no decomposition, so it is mapped explicitly.
 * Without that, `dong` vs `đồng` would not register as an accent-only miss.
 */
export function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFC');
}

export type AnswerVerdict =
  /** Matches one of this entry's accepted answers. */
  | 'correct'
  /**
   * A real word with this meaning, but not the one being asked for. Refused,
   * not graded — the field stays live and nothing advances.
   */
  | 'rejected'
  /** Neither. A plain wrong answer. */
  | 'wrong';

export interface ClassifyInput {
  typed: string;
  /** This entry's acceptable answers for the prompted direction. */
  accepted: readonly string[];
  /**
   * Target terms belonging to OTHER entries that share a meaning and part of
   * speech with this one — supplied by the dictionary, so `domain` stays pure.
   * Empty for the recognition vector, which has no synonym problem.
   */
  synonymTerms?: readonly string[];
}

/**
 * Classify a submitted answer.
 *
 * The three-way result is what keeps the grading table untouched: a rejection
 * is a refused submission, so `grading.ts` never sees it.
 */
export function classifyAnswer({
  typed,
  accepted,
  synonymTerms = [],
}: ClassifyInput): AnswerVerdict {
  const candidate = normalize(typed);
  if (candidate.length === 0) return 'wrong';

  for (const answer of accepted) {
    if (normalize(answer) === candidate) return 'correct';
  }
  for (const term of synonymTerms) {
    if (normalize(term) === candidate) return 'rejected';
  }
  return 'wrong';
}

export interface DiacriticDiff {
  /** True when the two differ ONLY in their accents. */
  diacriticsOnly: boolean;
  /** Indices that differ, for per-character highlighting. */
  positions: readonly number[];
}

/**
 * Compare a wrong answer against the expected one.
 *
 * ui.framework.md: per-character highlighting applies only when diacritics are
 * the sole difference. A substantively wrong answer shows both forms plainly —
 * highlighting every mismatched glyph there would be noise dressed as feedback.
 */
export function diacriticDiff(typed: string, expected: string): DiacriticDiff {
  const a = Array.from(normalize(typed));
  const b = Array.from(normalize(expected));

  const sameLetters =
    stripDiacritics(normalize(typed)) === stripDiacritics(normalize(expected));

  if (!sameLetters || a.length !== b.length) {
    return { diacriticsOnly: false, positions: [] };
  }

  const positions: number[] = [];
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) positions.push(i);
  }

  return { diacriticsOnly: positions.length > 0, positions };
}
