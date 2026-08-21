/**
 * S5 — multiple-choice distractor selection.
 *
 * framework.md: three distractors sharing the correct answer's part of speech,
 * drawn from the user's own deck first and the wider dictionary only as
 * fallback. Deck-first is not about deck size — it closes a leak. If the answer
 * always came from the deck and the distractors always from outside it, the
 * user would stop translating and start picking the word they recognise.
 */

import { shuffle } from './random';
import { defaultRng, type Rng, type WordKey } from './types';

export interface DistractorCandidate {
  key: WordKey;
  /** The word in the target language. Used for the same-spelling exclusion. */
  targetTerm: string;
  partOfSpeech: string;
  /** The text actually shown as an option. */
  displayed: string;
}

export interface DistractorRequest {
  correct: DistractorCandidate;
  /** Candidates from the deck being studied. Preferred. */
  deckPool: readonly DistractorCandidate[];
  /** Candidates from the wider dictionary. Fallback only. */
  dictionaryPool: readonly DistractorCandidate[];
  /** Total options including the correct one. */
  optionCount?: number;
  rng?: Rng;
}

export interface DistractorResult {
  /** Shuffled options including the correct answer. */
  options: readonly DistractorCandidate[];
  /** True when the part-of-speech constraint had to be relaxed. */
  relaxedPartOfSpeech: boolean;
  /** True when fewer options than requested could be built. */
  short: boolean;
}

/** Below this the question stops being answerable at all. */
const MIN_OPTIONS = 2;

/**
 * Build the option set.
 *
 * Degradation ladder when the pools are too thin: same part of speech → any
 * part of speech → fewer options, minimum two. It never fails. This exists for
 * the 20-word seed pack, where three same-part-of-speech nouns may simply not
 * be available; real packs should never reach past the first rung.
 */
export function pickDistractors(req: DistractorRequest): DistractorResult {
  const rng = req.rng ?? defaultRng;
  const wanted = (req.optionCount ?? 4) - 1;

  // Entries sharing the answer's spelling are excluded outright. Because
  // entries are split per sense, `banco` exists twice — offering both *bank*
  // and *bench* would mark a user wrong for knowing the word.
  const eligible = (pool: readonly DistractorCandidate[]) =>
    pool.filter(
      (c) =>
        c.key !== req.correct.key &&
        c.targetTerm !== req.correct.targetTerm &&
        c.displayed !== req.correct.displayed,
    );

  const samePos = (pool: readonly DistractorCandidate[]) =>
    pool.filter((c) => c.partOfSpeech === req.correct.partOfSpeech);

  const deck = eligible(req.deckPool);
  const dict = eligible(req.dictionaryPool);

  const picked: DistractorCandidate[] = [];
  const taken = new Set<WordKey>();
  // Two DIFFERENT entries can carry the same meaning — `salir` and `dejar` are
  // both "to leave" — so options are deduplicated by what is SHOWN, not only by
  // key. Otherwise the same text appears twice and one of the two identical
  // options is arbitrarily wrong.
  const shown = new Set<string>([req.correct.displayed.toLocaleLowerCase()]);

  const drawFrom = (pool: readonly DistractorCandidate[]) => {
    const available = shuffle(
      pool.filter((c) => !taken.has(c.key) && !shown.has(c.displayed.toLocaleLowerCase())),
      rng,
    );
    for (const candidate of available) {
      if (picked.length >= wanted) return;
      const label = candidate.displayed.toLocaleLowerCase();
      if (shown.has(label)) continue;
      picked.push(candidate);
      taken.add(candidate.key);
      shown.add(label);
    }
  };

  // Rung 1: same part of speech, deck first.
  drawFrom(samePos(deck));
  drawFrom(samePos(dict));
  const relaxedPartOfSpeech = picked.length < wanted;

  // Rung 2: any part of speech.
  if (picked.length < wanted) drawFrom(deck);
  if (picked.length < wanted) drawFrom(dict);

  // Rung 3: accept fewer options.
  const options = shuffle([req.correct, ...picked], rng);

  return {
    options,
    relaxedPartOfSpeech,
    short: options.length < (req.optionCount ?? 4),
  };
}

/** Whether an option set is usable at all. */
export function isAnswerable(result: DistractorResult): boolean {
  return result.options.length >= MIN_OPTIONS;
}

