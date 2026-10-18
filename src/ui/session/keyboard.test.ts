/**
 * S20 — key bindings per phase.
 *
 * The phase table is what keeps Enter from meaning two things at once, so the
 * cases that matter are the ones where the same key changes meaning.
 */
import { describe, expect, it } from 'vitest';
import { fieldShouldBeFocused, resolveKey, type KeyContext } from './keyboard';

/** Only the four fields `resolveKey` reads, so no DOM is needed. */
const press = (key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent =>
  ({ key, ctrlKey: false, metaKey: false, altKey: false, ...modifiers }) as KeyboardEvent;

const ctx = (over: Partial<KeyContext> = {}): KeyContext => ({
  phase: 'typing',
  hasInput: false,
  numericSelect: false,
  ...over,
});

describe('answering', () => {
  it('submits a filled field and primes an empty one', () => {
    expect(resolveKey(press('Enter'), ctx({ hasInput: true }))).toBe('submit');
    expect(resolveKey(press('Enter'), ctx({ hasInput: false }))).toBe('prime');
  });

  it('selects by number only where the question is multiple choice', () => {
    expect(resolveKey(press('3'), ctx({ numericSelect: true }))).toEqual({ select: 2 });
    expect(resolveKey(press('3'), ctx({ numericSelect: false }))).toBe('ignore');
    expect(resolveKey(press('5'), ctx({ numericSelect: true }))).toBe('ignore');
  });

  it('holds Tab rather than letting focus leave the field', () => {
    expect(resolveKey(press('Tab'), ctx())).toBe('ignore');
  });

  it('never steals a modified key from the browser', () => {
    expect(resolveKey(press('Enter', { ctrlKey: true }), ctx({ hasInput: true }))).toBe('ignore');
    expect(resolveKey(press('r', { metaKey: true }), ctx({ phase: 'resultWrong' }))).toBe('ignore');
  });
});

describe('primed — "submit nothing?"', () => {
  it('confirms I-don-t-know only while the field is still empty', () => {
    expect(resolveKey(press('Enter'), ctx({ phase: 'primed', hasInput: false }))).toBe('dontKnow');
  });

  it('submits what was typed after priming, instead of discarding it', () => {
    // The reported defect: Enter on an empty field, then typing the right
    // answer, then Enter — graded wrong, with nothing shown to compare.
    expect(resolveKey(press('Enter'), ctx({ phase: 'primed', hasInput: true }))).toBe('submit');
  });

  it('leaves multiple choice answerable by number', () => {
    expect(resolveKey(press('2'), ctx({ phase: 'primed', numericSelect: true }))).toEqual({
      select: 1,
    });
  });

  it('ignores other keys', () => {
    expect(resolveKey(press('m'), ctx({ phase: 'primed' }))).toBe('ignore');
  });
});

describe('after a result', () => {
  it('offers only Continue when the answer was correct', () => {
    expect(resolveKey(press('Enter'), ctx({ phase: 'resultCorrect' }))).toBe('continue');
    expect(resolveKey(press('m'), ctx({ phase: 'resultCorrect' }))).toBe('ignore');
    expect(resolveKey(press('r'), ctx({ phase: 'resultCorrect' }))).toBe('ignore');
  });

  it('arms mark-correct and redo only after a wrong one', () => {
    expect(resolveKey(press('Enter'), ctx({ phase: 'resultWrong' }))).toBe('continue');
    expect(resolveKey(press('m'), ctx({ phase: 'resultWrong' }))).toBe('markCorrect');
    expect(resolveKey(press('R'), ctx({ phase: 'resultWrong' }))).toBe('redo');
  });
});

describe('field focus', () => {
  it('follows the field, not the result', () => {
    expect(fieldShouldBeFocused('typing')).toBe(true);
    expect(fieldShouldBeFocused('primed')).toBe(true);
    expect(fieldShouldBeFocused('rejected')).toBe(true);
    expect(fieldShouldBeFocused('resultWrong')).toBe(false);
  });
});
