/**
 * S19 — in-flight session state.
 *
 * `domain` COMPOSES the queue as a pure function; this holds where the user is
 * in it and which phase they are in. Composition is domain, progression is
 * runtime.
 *
 * The phase is an explicit value rather than a set of booleans because key
 * bindings resolve from it: `m` must type a letter while answering and mean
 * *mark correct* after a wrong submission. Inferring that from combinations of
 * flags is how Enter ends up double-submitting.
 */

import type { DictionaryEntry } from '../../dictionary/pack-format';
import { entriesByPartOfSpeech, entriesForLanguage, getEntries, synonymTerms } from '../../dictionary/queries';
import { pickDistractors, type DistractorResult } from '../../domain/distractors';
import { grade, resolveRequeue, type Outcome, type RequeueOutcome } from '../../domain/grading';
import { toDayNumber, type DayNumber } from '../../domain/ladder';
import { classifyAnswer, type AnswerVerdict } from '../../domain/matching';
import { composeSession, type SessionSettings } from '../../domain/session';
import type { Card, WordKey } from '../../domain/types';
import { QuestionMethod, vectorById } from '../../domain/vectors';
import { deckMembers, sessionSettingsFor, type DeckRow } from '../../progress/deck-repo';
import { getWordProgress, recordGrade } from '../../progress/progress-repo';

export type Phase =
  /** Field focused, all keys go to it. */
  | 'typing'
  /** Enter was pressed on an empty field; a second Enter is *I don't know*. */
  | 'primed'
  /** A real word, but not the one asked for. Field stays live, nothing graded. */
  | 'rejected'
  /** Answered right. Desktop advances at once; mobile dwells. */
  | 'resultCorrect'
  /** Answered wrong. Always dwells — nothing auto-advances past a decision. */
  | 'resultWrong';

export interface PresentedCard {
  card: Card;
  entry: DictionaryEntry;
  method: QuestionMethod;
  /** Multiple choice only. */
  options?: DistractorResult['options'];
  /** Typed vector only — terms of other entries sharing this meaning. */
  synonyms?: readonly string[];
  /** Which meaning is being prompted, for the typed vector. */
  promptedMeaning?: string;
}

export interface ResolvedResult {
  correct: boolean;
  /** What the user submitted — typed text, or the option they picked. */
  typed: string;
  /**
   * The answer they were being asked for, on the side the VECTOR expects: the
   * target term for the typed vector, a meaning for multiple choice. Deriving
   * this from the entry alone names the wrong half of the card.
   */
  expected: string;
  /** Absent on a re-query appearance, where the level never moves. */
  movement?: { from: number; to: number };
}

export interface SessionTally {
  promoted: number;
  held: number;
  demoted: number;
  mastered: number;
}

const EMPTY_TALLY: SessionTally = { promoted: 0, held: 0, demoted: 0, mastered: 0 };

/**
 * The answer the card was actually asking for.
 *
 * Recognition asks for a MEANING and production asks for the TERM, so reading
 * `entry.term` in both cases tells half of all users they were asked for the
 * wrong side of the card.
 */
function expectedAnswerFor(card: PresentedCard): string {
  return card.method === QuestionMethod.FOREIGN_TO_BASE_MC
    ? card.entry.meanings.join(', ')
    : card.entry.term;
}

export class SessionStore {
  deck = $state<DeckRow | undefined>(undefined);
  settings = $state<SessionSettings | undefined>(undefined);
  today = $state<DayNumber>(toDayNumber());

  /** Cards drawn for this session. `n of N` counts these. */
  drawn = $state<Card[]>([]);
  /** Cards awaiting an ungraded second look. Never grows while being worked. */
  requeue = $state<Card[]>([]);

  current = $state<PresentedCard | undefined>(undefined);
  /** The card shown in the result pane — one behind on desktop, by design. */
  lastResolved = $state<PresentedCard | undefined>(undefined);
  /**
   * What actually happened to `lastResolved`, recorded at resolution time.
   *
   * The panel must not infer this from live state: a correct answer
   * auto-advances on desktop, so by the time the panel renders the phase has
   * already returned to `typing` and the outcome is no longer readable there.
   */
  lastResult = $state<ResolvedResult | undefined>(undefined);

  phase = $state<Phase>('typing');
  typed = $state('');
  verdict = $state<AnswerVerdict | undefined>(undefined);
  /** Level movement to show on the result panel. */
  movement = $state<{ from: number; to: number } | undefined>(undefined);

  tally = $state<SessionTally>({ ...EMPTY_TALLY });
  finished = $state(false);
  loading = $state(false);

  /** Words resolved so far. Advances on GRADING only, never on a re-query. */
  graded = $state(0);

  #entries = new Map<WordKey, DictionaryEntry>();
  /** Must be `$state`: the header reads it, and a plain field is not tracked. */
  #inRequeuePass = $state(false);

  /**
   * Cards drawn at composition. Captured rather than derived from `drawn`,
   * which shrinks as cards are graded — deriving it made the counter read
   * "3 of 2" as the denominator fell while the numerator climbed.
   */
  #total = $state(0);

  get total(): number {
    return this.#total;
  }

  /** True once the drawn queue is done and only re-queried cards remain. */
  get inRequeuePass(): boolean {
    return this.#inRequeuePass;
  }

  async start(deck: DeckRow): Promise<void> {
    this.loading = true;
    this.reset();

    this.deck = deck;
    this.settings = sessionSettingsFor(deck);
    this.today = toDayNumber();

    const members = await deckMembers(deck);
    const progress = await getWordProgress(members.map((m) => m.key));

    const composed = composeSession({
      members,
      progress,
      settings: this.settings,
      today: this.today,
    });

    this.drawn = [...composed.queue];
    this.#total = composed.queue.length;

    const entries = await getEntries(this.drawn.map((c) => c.wordKey));
    this.#entries = new Map(entries.map((e) => [e.key, e]));

    this.loading = false;
    await this.#present();
  }

  /** New words in this session, for the introduction screen. */
  get newCards(): Card[] {
    return this.drawn.filter((c) => c.isNew);
  }

  entryFor(key: WordKey): DictionaryEntry | undefined {
    return this.#entries.get(key);
  }

  reset(): void {
    this.drawn = [];
    this.requeue = [];
    this.current = undefined;
    this.lastResolved = undefined;
    this.lastResult = undefined;
    this.phase = 'typing';
    this.typed = '';
    this.verdict = undefined;
    this.movement = undefined;
    this.tally = { ...EMPTY_TALLY };
    this.finished = false;
    this.graded = 0;
    this.#total = 0;
    this.#entries = new Map();
    this.#inRequeuePass = false;
  }

  async #present(): Promise<void> {
    this.typed = '';
    this.verdict = undefined;
    this.movement = undefined;
    this.phase = 'typing';

    const next = this.drawn[0] ?? this.requeue[0];
    if (!next) {
      this.current = undefined;
      this.finished = true;
      return;
    }

    this.#inRequeuePass = this.drawn.length === 0;

    const entry = this.#entries.get(next.wordKey);
    if (!entry) {
      // The word vanished from the dictionary between composition and now.
      // Drop the card rather than showing an empty question.
      this.#drop(next);
      return this.#present();
    }

    const vector = vectorById(next.vectorId);
    const method = vector?.method ?? QuestionMethod.FOREIGN_TO_BASE_MC;

    if (method === QuestionMethod.FOREIGN_TO_BASE_MC) {
      this.current = {
        card: next,
        entry,
        method,
        options: await this.#buildOptions(entry),
      };
    } else {
      this.current = {
        card: next,
        entry,
        method,
        synonyms: await synonymTerms(entry),
        promptedMeaning: entry.meanings[0] ?? '',
      };
    }
  }

  /**
   * Distractors are re-drawn on every presentation, so a repeated card never
   * shows the same set — otherwise by the third exposure you are recognising
   * the set rather than the word.
   */
  async #buildOptions(entry: DictionaryEntry) {
    const deckPool = [...this.#entries.values()]
      .filter((e) => e.key !== entry.key)
      .map((e) => ({
        key: e.key,
        targetTerm: e.term,
        partOfSpeech: e.partOfSpeech,
        displayed: e.meanings[0] ?? e.term,
      }));

    const samePos = await entriesByPartOfSpeech(entry.language, entry.partOfSpeech);
    const wider = samePos.length > 4 ? samePos : await entriesForLanguage(entry.language);

    const dictionaryPool = wider
      .filter((e) => e.key !== entry.key)
      .map((e) => ({
        key: e.key,
        targetTerm: e.term,
        partOfSpeech: e.partOfSpeech,
        displayed: e.meanings[0] ?? e.term,
      }));

    return pickDistractors({
      correct: {
        key: entry.key,
        targetTerm: entry.term,
        partOfSpeech: entry.partOfSpeech,
        displayed: entry.meanings[0] ?? entry.term,
      },
      deckPool,
      dictionaryPool,
    }).options;
  }

  /** Submit a typed answer or a selected option. */
  async submit(answer: string): Promise<void> {
    const card = this.current;
    if (!card) return;

    const accepted =
      card.method === QuestionMethod.FOREIGN_TO_BASE_MC
        ? card.entry.meanings
        : [card.entry.term];

    const verdict = classifyAnswer({
      typed: answer,
      accepted,
      synonymTerms: card.synonyms ?? [],
    });

    this.typed = answer;
    this.verdict = verdict;

    // A rejection is a REFUSED SUBMISSION, not an outcome: the field stays
    // live, nothing is graded, and the counter does not move.
    if (verdict === 'rejected') {
      this.phase = 'rejected';
      return;
    }

    if (verdict === 'correct') {
      await this.#settle('correct');
      // Deliberately does NOT advance: desktop auto-advances from the screen,
      // mobile dwells, and that difference belongs to layout not to state.
      return;
    }

    // Wrong, and NOT yet graded — the outcome depends on which button comes
    // next. Pressing nothing is what demotes.
    //
    // The panel is filled in NOW rather than at grading time: this is the
    // moment the user needs to see the right answer and reach the two buttons,
    // and grading does not happen until they choose. `movement` stays absent
    // until it does.
    this.#show(card, { correct: false, typed: answer, expected: expectedAnswerFor(card) });
    this.phase = 'resultWrong';
  }

  #show(card: PresentedCard, result: ResolvedResult): void {
    this.lastResolved = card;
    this.lastResult = result;
  }

  /** Enter on an empty field primes; a second Enter is *I don't know*. */
  prime(): void {
    this.phase = 'primed';
  }

  /** Same landing place as a wrong answer with nothing pressed. */
  dontKnow(): void {
    const card = this.current;
    if (!card) return;
    this.verdict = 'wrong';
    this.#show(card, { correct: false, typed: '', expected: expectedAnswerFor(card) });
    this.phase = 'resultWrong';
  }

  /** Wrong answer, *Mark correct* pressed. */
  async chooseMarkCorrect(): Promise<void> {
    await this.#settle('markCorrect');
    await this.advance();
  }

  /** Wrong answer, *Redo question* pressed. */
  async chooseRedo(): Promise<void> {
    await this.#settle('redo');
    await this.advance();
  }

  /** Wrong answer, nothing pressed — accept the demotion and continue. */
  async chooseAccept(): Promise<void> {
    await this.#settle('none');
    await this.advance();
  }

  /**
   * The single place a card is resolved.
   *
   * Two regimes, and which one applies is decided by whether the drawn queue is
   * exhausted — never by the caller, so no entry point can grade a card twice.
   */
  async #settle(outcome: Outcome): Promise<void> {
    const card = this.current;
    if (!card) return;

    if (this.#inRequeuePass) {
      this.#settleRequeue(card, outcome);
      return;
    }

    const progress = await getWordProgress([card.card.wordKey]);
    const state = progress.get(card.card.wordKey)?.vectors[card.card.vectorId];
    const from = state?.level ?? 0;
    const dueDay = state?.dueDay ?? this.today;

    const result = grade({ level: from, dueDay }, outcome, this.today);

    // Written the moment it is made — no batching, no end-of-session flush.
    await recordGrade({
      wordKey: card.card.wordKey,
      vectorId: card.card.vectorId,
      level: result.level,
      dueDay: result.dueDay,
      today: this.today,
    });

    this.#count(from, result.level);
    this.movement = { from, to: result.level };
    this.graded += 1;

    this.drawn = this.drawn.filter((c) => c !== card.card);
    if (result.requeue) this.requeue = [...this.requeue, card.card];

    this.#show(card, {
      // *Mark correct* raises the level but the answer WAS wrong, so the panel
      // says so and shows the promotion beside it. Claiming it was correct
      // would hide what the user is being shown the entry for.
      correct: outcome === 'correct',
      typed: this.typed,
      expected: expectedAnswerFor(card),
      movement: { from, to: result.level },
    });
    this.phase = outcome === 'correct' ? 'resultCorrect' : 'resultWrong';
  }

  /**
   * A re-query appearance. The level NEVER moves here, however often a card
   * recurs — otherwise a demotion could always be undone and none would stick.
   *
   * *Mark correct* is the exit for a word the user genuinely cannot produce:
   * it clears the card without grading it. Without that the session could not
   * be finished.
   */
  #settleRequeue(card: PresentedCard, outcome: Outcome): void {
    const requeueOutcome: RequeueOutcome =
      outcome === 'correct' ? 'correct' : outcome === 'markCorrect' ? 'markCorrect' : 'wrong';

    const { clears } = resolveRequeue(requeueOutcome);
    const without = this.requeue.filter((c) => c !== card.card);

    this.requeue = clears ? without : [...without, card.card];
    // No movement: a re-query appearance never changes a level.
    this.#show(card, {
      correct: requeueOutcome === 'correct',
      typed: this.typed,
      expected: expectedAnswerFor(card),
    });
    this.phase = clears ? 'resultCorrect' : 'resultWrong';
  }

  async advance(): Promise<void> {
    await this.#present();
  }

  #drop(card: Card): void {
    this.drawn = this.drawn.filter((c) => c !== card);
    this.requeue = this.requeue.filter((c) => c !== card);
  }

  #count(from: number, to: number): void {
    const next = { ...this.tally };
    if (to > from) next.promoted += 1;
    else if (to < from) next.demoted += 1;
    else next.held += 1;
    if (to === 9 && from !== 9) next.mastered += 1;
    this.tally = next;
  }
}

export const session = new SessionStore();
