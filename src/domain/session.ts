/**
 * S6 — session composition.
 *
 * framework.md, in order of consequence:
 *  - ONE word yields exactly ONE card. Selection considers only the vectors
 *    actually due; among those the lower level wins, ties random. This is what
 *    keeps the new-word budget honest — a new word has every vector at 0, so
 *    without it "5 new words" would mean 10 cards and crowd out every review.
 *  - NEW WORDS FILL FIRST, reviews take the remainder. Deliberate: reviews-first
 *    would control the backlog, but once the pile is large the user never sees
 *    new vocabulary again and the app becomes pure chore. The brake is manual —
 *    lower new-words-per-day, or set it to 0 to catch up.
 *  - Reviews are ordered most-overdue-first, `today − dueDay`.
 */

import { isDue, isMastered, overdueBy, NEW_LEVEL, type DayNumber } from './ladder';
import { randomOf, shuffle } from './random';
import {
  TIER_WEIGHT,
  defaultRng,
  type Card,
  type DeckMember,
  type Rng,
  type WordKey,
  type WordProgress,
} from './types';
import type { VectorId } from './vectors';

export interface SessionSettings {
  /** Ceiling on cards in one session. Not a quota. */
  cardCap: number;
  newWordsPerDay: number;
  enabledVectors: readonly VectorId[];
  /** When false, level-9 words are withheld entirely. */
  requeryMastered: boolean;
}

export interface ComposeInput {
  members: readonly DeckMember[];
  progress: ReadonlyMap<WordKey, WordProgress>;
  settings: SessionSettings;
  today: DayNumber;
  rng?: Rng;
}

export interface ComposedSession {
  queue: readonly Card[];
  newCount: number;
  reviewCount: number;
  /** Due cards that did not fit under the cap. Feeds the overdue display. */
  deferred: number;
}

export function composeSession(input: ComposeInput): ComposedSession {
  const rng = input.rng ?? defaultRng;
  const { members, progress, settings, today } = input;

  const visible = members.filter((m) => !progress.get(m.key)?.hidden);

  const introducedToday = visible.filter(
    (m) => progress.get(m.key)?.introducedOn === today,
  ).length;

  const newBudget = Math.max(0, settings.newWordsPerDay - introducedToday);

  const unseen = visible.filter((m) => progress.get(m.key)?.introducedOn === undefined);
  const seen = visible.filter((m) => progress.get(m.key)?.introducedOn !== undefined);

  const newCards = pickNewWords(unseen, Math.min(newBudget, settings.cardCap), settings, rng);

  const reviewCards = buildReviewCards(seen, progress, settings, today, rng);

  const remaining = Math.max(0, settings.cardCap - newCards.length);
  const takenReviews = reviewCards.slice(0, remaining);

  return {
    // Selection is ordered — most overdue first — because that decides which
    // reviews make the cut when the cap bites. PRESENTATION is then shuffled,
    // so new words land throughout the session rather than bunched at the
    // front where the hardest cards would all arrive least warmed up.
    queue: shuffle([...newCards, ...takenReviews], rng),
    newCount: newCards.length,
    reviewCount: takenReviews.length,
    deferred: reviewCards.length - takenReviews.length,
  };
}

/**
 * Weighted random sampling over difficulty tier, without replacement.
 *
 * Frequency rank is not stored — only the tier the pack already carries — so
 * the tier weights stand in for it. Rarer words still surface before the batch
 * is exhausted, which stops the deck feeling like a dictionary read front to
 * back.
 */
function pickNewWords(
  unseen: readonly DeckMember[],
  budget: number,
  settings: SessionSettings,
  rng: Rng,
): Card[] {
  if (budget <= 0 || unseen.length === 0) return [];

  const pool = unseen.slice();
  const chosen: Card[] = [];

  while (chosen.length < budget && pool.length > 0) {
    const eligible = mainSensesFirst(pool);
    const total = eligible.reduce((sum, m) => sum + TIER_WEIGHT[m.difficulty], 0);
    let roll = rng() * total;
    let member = eligible[eligible.length - 1]!;

    for (const candidate of eligible) {
      roll -= TIER_WEIGHT[candidate.difficulty];
      if (roll <= 0) {
        member = candidate;
        break;
      }
    }

    pool.splice(pool.indexOf(member), 1);
    // Every vector of a new word sits at level 0, so all are equally due and
    // the tie-break is the only thing choosing.
    const vectorId = randomOf(settings.enabledVectors, rng);
    if (vectorId) chosen.push({ wordKey: member.key, vectorId, isNew: true });
  }

  return chosen;
}

/** Easiest first; the order `TIER_WEIGHT` already expresses. */
const TIER_ORDER: Readonly<Record<DeckMember['difficulty'], number>> = Object.freeze({
  basic: 0,
  common: 1,
  advanced: 2,
  niche: 3,
});

/** `es:banco:noun:2` → `es:banco`. Keys never contain a colon inside a part. */
function termOf(key: WordKey): string {
  const [language, term] = key.split(':');
  return `${language}:${term}`;
}

/**
 * A sense is held back while an EASIER sense of the same word is still
 * unseen: `lại` "to recover" waits until "again" and "to come" have been met.
 *
 * Tier weighting alone was too mild for this — at 4:3 a harder sense was only a
 * quarter less likely, so a learner could meet a word's rare meaning first and
 * reasonably conclude that was what the word meant. Tiers carry sense-level
 * usage since packs band unattested senses down, so the easiest unseen sense of
 * a word is the one most worth meeting first.
 */
function mainSensesFirst(pool: readonly DeckMember[]): DeckMember[] {
  const easiest = new Map<string, number>();
  for (const m of pool) {
    const term = termOf(m.key);
    easiest.set(term, Math.min(easiest.get(term) ?? Infinity, TIER_ORDER[m.difficulty]));
  }
  return pool.filter((m) => TIER_ORDER[m.difficulty] === easiest.get(termOf(m.key)));
}

interface ReviewCandidate {
  card: Card;
  overdue: number;
}

function buildReviewCards(
  seen: readonly DeckMember[],
  progress: ReadonlyMap<WordKey, WordProgress>,
  settings: SessionSettings,
  today: DayNumber,
  rng: Rng,
): Card[] {
  const candidates: ReviewCandidate[] = [];

  for (const member of seen) {
    const word = progress.get(member.key);
    if (!word) continue;

    const due: { vectorId: VectorId; level: number; dueDay: number }[] = [];

    for (const vectorId of settings.enabledVectors) {
      const state = word.vectors[vectorId];
      // A vector with no row has never been scheduled. Introduction is what
      // makes every vector live, so its due day is the day the word was
      // introduced — giving it honest overdue rather than pinning it at zero,
      // which would sort the most neglected words to the back of every session.
      const level = state?.level ?? NEW_LEVEL;
      const dueDay = state?.dueDay ?? word.introducedOn ?? today;

      if (isMastered(level) && !settings.requeryMastered) continue;
      if (!isDue(dueDay, today)) continue;

      due.push({ vectorId, level, dueDay });
    }

    if (due.length === 0) continue;

    // Lower level wins among the DUE vectors; a vector that is not due is never
    // a candidate, whatever its level.
    const lowest = Math.min(...due.map((d) => d.level));
    const tied = due.filter((d) => d.level === lowest);
    const pick = tied.length === 1 ? tied[0]! : randomOf(tied, rng)!;

    candidates.push({
      card: { wordKey: member.key, vectorId: pick.vectorId, isNew: false },
      overdue: overdueBy(pick.dueDay, today),
    });
  }

  // Most overdue first. Ties break arbitrarily — a stable ordering buys nothing
  // here and speed matters more.
  candidates.sort((a, b) => b.overdue - a.overdue);
  return candidates.map((c) => c.card);
}
