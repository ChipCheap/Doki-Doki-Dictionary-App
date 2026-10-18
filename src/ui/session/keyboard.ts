/**
 * S20 — keyboard bindings, resolved from the session phase.
 *
 * The same key means different things at different moments: `m` types a letter
 * while answering and means *mark correct* after a wrong submission. Resolving
 * bindings from an explicit phase makes that a lookup instead of a pile of
 * conditionals — which is how Enter ends up double-submitting.
 *
 * The phase boundary is also what makes the shortcuts safe: `m` and `r` are
 * only live in a result phase, which only exists after a WRONG answer. A run of
 * correct answers never has them active at all.
 */

import type { Phase } from './session-store.svelte';

export type KeyAction =
  | 'submit'
  | 'prime'
  | 'dontKnow'
  | 'continue'
  | 'markCorrect'
  | 'redo'
  | { select: number }
  | 'ignore';

export interface KeyContext {
  phase: Phase;
  /** Whether the answer field currently holds anything non-blank. */
  hasInput: boolean;
  /** Multiple choice accepts 1–4; the typed vector does not. */
  numericSelect: boolean;
}

export function resolveKey(event: KeyboardEvent, ctx: KeyContext): KeyAction {
  // Never steal a key that carries a modifier — those belong to the browser.
  if (event.ctrlKey || event.metaKey || event.altKey) return 'ignore';

  switch (ctx.phase) {
    case 'typing':
    case 'rejected': {
      if (event.key === 'Enter') return ctx.hasInput ? 'submit' : 'prime';
      // Nothing to tab to during typing, and every action has a key — so Tab is
      // suppressed rather than moving focus off the field mid-answer.
      if (event.key === 'Tab') return 'ignore';
      if (ctx.numericSelect && /^[1-4]$/.test(event.key)) {
        return { select: Number(event.key) - 1 };
      }
      return 'ignore';
    }

    case 'primed': {
      /*
       * A second Enter confirms — but ONLY while the field is still empty.
       *
       * Priming used to swallow whatever was typed afterwards: Enter on an
       * empty field primed the card, typing changed the text without changing
       * the phase, and the next Enter resolved as *I don't know*. The answer
       * was discarded, the card was graded wrong, and the result panel showed
       * no comparison because there was nothing typed to compare. Reported
       * twice from real sessions, on answers that were correct.
       *
       * `Quiz.svelte` also leaves this phase as soon as the field is written
       * to, so the "submit nothing?" hint cannot linger over a filled field.
       * This stays as the guard of the rule itself: a non-empty answer is
       * never thrown away as "I don't know".
       */
      if (event.key === 'Enter') return ctx.hasInput ? 'submit' : 'dontKnow';
      // Multiple choice has no field to fill, so priming must not disarm its
      // only keys — 1-4 stayed dead until the card was clicked.
      if (ctx.numericSelect && /^[1-4]$/.test(event.key)) {
        return { select: Number(event.key) - 1 };
      }
      return 'ignore';
    }

    case 'resultCorrect': {
      if (event.key === 'Enter') return 'continue';
      return 'ignore';
    }

    case 'resultWrong': {
      if (event.key === 'Enter') return 'continue';
      if (event.key === 'm' || event.key === 'M') return 'markCorrect';
      if (event.key === 'r' || event.key === 'R') return 'redo';
      // Tab cycles the two buttons, so someone who does not know the shortcuts
      // can still reach them without a pointer.
      return 'ignore';
    }
  }
}

/** True while the answer field should hold focus. */
export function fieldShouldBeFocused(phase: Phase): boolean {
  return phase === 'typing' || phase === 'rejected' || phase === 'primed';
}
