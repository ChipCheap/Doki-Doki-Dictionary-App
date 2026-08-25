/**
 * Vietnamese compound recovery by dictionary-based segmentation.
 *
 * Vietnamese writes each SYLLABLE space-separated, so a whitespace-tokenized
 * frequency list never sees a polysyllabic word as a unit. Measured on the real
 * data: kaikki carries 21,740 Vietnamese compounds and the OpenSubtitles list
 * ranks 75 of them — 0.3%. Selecting on that list alone produced a pack of
 * 2,003 single syllables, many of them bound morphemes that are not words on
 * their own, while `bệnh viện`, `gia đình` and `học sinh` were all present in
 * the source and all unranked.
 *
 * The fix uses only sources already licensed here: Wiktionary supplies the
 * inventory of real compounds, and the Tatoeba corpus supplies text to count
 * them in. Longest-match means a syllable absorbed into a compound is not also
 * counted alone, so both come out of one corpus on one consistent basis.
 *
 * The corpus is small — 32,431 Vietnamese sentences — so the tail is thin:
 * 5,493 compounds appear at least once and 3,366 at least twice. That is ample
 * for a pack of a few thousand terms and would not be for a large one.
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { normalizeTerm } from './registry';

/** Longest compound considered. Vietnamese words beyond four syllables are rare. */
const MAX_SYLLABLES = 4;

export interface SegmentedCounts {
  /** term (compound or single syllable) → occurrences */
  counts: Map<string, number>;
  sentences: number;
}

/**
 * Count known words in a Tatoeba export by longest match.
 *
 * `known` holds the multi-syllable terms to look for. Single syllables are
 * counted too, but only where no compound claimed them, which is what keeps the
 * two comparable.
 */
export async function segmentCorpus(
  sentencesPath: string,
  known: ReadonlySet<string>,
): Promise<SegmentedCounts> {
  const counts = new Map<string, number>();
  let sentences = 0;

  const lines = createInterface({
    input: createReadStream(sentencesPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    const text = line.split('\t')[2];
    if (!text) continue;
    sentences += 1;

    const syllables = normalizeTerm(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

    for (let i = 0; i < syllables.length; i += 1) {
      let matched = 0;

      for (let n = Math.min(MAX_SYLLABLES, syllables.length - i); n >= 2; n -= 1) {
        const candidate = syllables.slice(i, i + n).join(' ');
        if (known.has(candidate)) {
          counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
          matched = n;
          break;
        }
      }

      if (matched > 0) {
        i += matched - 1;
        continue;
      }

      const syllable = syllables[i]!;
      counts.set(syllable, (counts.get(syllable) ?? 0) + 1);
    }
  }

  return { counts, sentences };
}

/**
 * Merge segmented counts into an existing rank map.
 *
 * A term the segmentation saw is ranked among the segmented counts; a term it
 * did not see keeps whatever rank the frequency list gave it, shifted below the
 * segmented block. Occurrences are required to reach `minCount` before a term
 * is trusted at all — a compound seen once in 32,000 sentences is noise, and
 * ranking on noise would push real vocabulary out.
 */
export function mergeRanks(
  segmented: ReadonlyMap<string, number>,
  fallback: ReadonlyMap<string, number>,
  minCount = 2,
): Map<string, number> {
  const trusted = [...segmented.entries()]
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const ranks = new Map<string, number>();
  trusted.forEach(([term], index) => ranks.set(term, index + 1));

  const offset = ranks.size;
  for (const [term, rank] of fallback) {
    if (!ranks.has(term)) ranks.set(term, offset + rank);
  }

  return ranks;
}
