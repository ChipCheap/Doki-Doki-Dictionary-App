/**
 * S3 — learning vectors and the question-method enum.
 *
 * framework.md: a vector is (prompt side, answer side, input method) — not
 * merely a direction. Two vectors may share a direction and differ only in
 * method. Adding one is a new enum value, a new component, and a line of
 * language configuration: nothing in scheduling, grading or storage changes.
 *
 * No component references live here — `domain` may not import from `ui`
 * (architecture.md guideline 1). The UI keeps its own registry keyed by method.
 */

/** The closed set of question types the app actually implements. */
export const QuestionMethod = {
  /** Show the target word, pick its meaning from four options. */
  FOREIGN_TO_BASE_MC: 'FOREIGN_TO_BASE_MC',
  /** Show a meaning, type the target word — orthographically exact. */
  BASE_TO_FOREIGN_TEXT: 'BASE_TO_FOREIGN_TEXT',
} as const;

export type QuestionMethod =
  (typeof QuestionMethod)[keyof typeof QuestionMethod];

export type VectorId = string;

export type Side = 'target' | 'base';

export interface VectorDefinition {
  id: VectorId;
  method: QuestionMethod;
  promptSide: Side;
  answerSide: Side;
  /** Shown in settings. Not user-facing prose; the UI owns wording. */
  label: string;
}

export const RECOGNITION: VectorDefinition = {
  id: 'recognition',
  method: QuestionMethod.FOREIGN_TO_BASE_MC,
  promptSide: 'target',
  answerSide: 'base',
  label: 'Recognition',
};

export const PRODUCTION: VectorDefinition = {
  id: 'production',
  method: QuestionMethod.BASE_TO_FOREIGN_TEXT,
  promptSide: 'base',
  answerSide: 'target',
  label: 'Production',
};

/** Every vector the app knows about. v1 ships two. */
export const ALL_VECTORS: readonly VectorDefinition[] = Object.freeze([
  RECOGNITION,
  PRODUCTION,
]);

export function vectorById(id: VectorId): VectorDefinition | undefined {
  return ALL_VECTORS.find((v) => v.id === id);
}

/**
 * Which vectors a language uses. Configuration, not code — a future reading
 * vector for Chinese or Japanese is a line here plus one component.
 */
export interface LanguageVectorConfig {
  language: string;
  enabled: readonly VectorId[];
}

export const DEFAULT_VECTOR_IDS: readonly VectorId[] = Object.freeze([
  RECOGNITION.id,
  PRODUCTION.id,
]);
