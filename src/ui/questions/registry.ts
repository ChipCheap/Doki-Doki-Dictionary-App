/**
 * S21 — the question-type registry.
 *
 * A map from method enum to its component plus a little metadata. Adding a
 * learning vector is one entry here and one component — nothing in scheduling,
 * grading or storage changes.
 *
 * A map rather than an interface each type implements: both vectors grade
 * identically and differ only in presentation, so a per-type contract would be
 * ceremony around two near-identical implementations.
 */

import type { Component } from 'svelte';
import { QuestionMethod } from '../../domain/vectors';
import MultipleChoice from './MultipleChoice.svelte';
import TypedAnswer from './TypedAnswer.svelte';

export interface QuestionType {
  component: Component<any>;
  /** Whether the session must build a distractor set for this method. */
  needsDistractors: boolean;
  /** Whether `1`–`4` select an option. */
  numericSelect: boolean;
  /** Whether the answer is typed, which decides focus handling. */
  typed: boolean;
}

export const QUESTION_TYPES: Record<QuestionMethod, QuestionType> = {
  [QuestionMethod.FOREIGN_TO_BASE_MC]: {
    component: MultipleChoice,
    needsDistractors: true,
    numericSelect: true,
    typed: false,
  },
  [QuestionMethod.BASE_TO_FOREIGN_TEXT]: {
    component: TypedAnswer,
    needsDistractors: false,
    numericSelect: false,
    typed: true,
  },
};

export function questionTypeFor(method: QuestionMethod): QuestionType {
  return QUESTION_TYPES[method] ?? QUESTION_TYPES[QuestionMethod.FOREIGN_TO_BASE_MC];
}
