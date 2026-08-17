import { describe, expect, it } from 'vitest';
import { classifyAnswer, diacriticDiff, normalize, stripDiacritics } from './matching';

describe('normalize', () => {
  it('trims and case-folds', () => {
    expect(normalize('  SÍ  ')).toBe('sí');
  });

  it('preserves diacritics — they are the answer, not noise', () => {
    expect(normalize('phản bội')).toBe('phản bội');
    expect(normalize('si')).not.toBe(normalize('sí'));
  });
});

describe('classifyAnswer', () => {
  const accepted = ['sí', 'claro'];

  it('accepts an exact match, whitespace and case aside', () => {
    expect(classifyAnswer({ typed: ' Sí ', accepted })).toBe('correct');
  });

  it('accepts any listed synonym', () => {
    expect(classifyAnswer({ typed: 'claro', accepted })).toBe('correct');
  });

  it('rejects a missing accent as wrong, not close enough', () => {
    expect(classifyAnswer({ typed: 'si', accepted })).toBe('wrong');
  });

  it('treats an empty answer as wrong', () => {
    expect(classifyAnswer({ typed: '   ', accepted })).toBe('wrong');
  });

  it('refuses a valid word belonging to another entry', () => {
    // Prompted with "to leave" for `salir`; `dejar` is a real translation of the
    // same meaning but not the one being asked for.
    const verdict = classifyAnswer({
      typed: 'dejar',
      accepted: ['salir'],
      synonymTerms: ['dejar'],
    });
    expect(verdict).toBe('rejected');
  });

  it('prefers correct over rejected when a word is both', () => {
    const verdict = classifyAnswer({
      typed: 'salir',
      accepted: ['salir'],
      synonymTerms: ['salir', 'dejar'],
    });
    expect(verdict).toBe('correct');
  });
});

describe('stripDiacritics', () => {
  it('reduces Spanish accents', () => {
    expect(stripDiacritics('sí')).toBe('si');
  });

  it('reduces Vietnamese tone marks and stacked diacritics', () => {
    expect(stripDiacritics('phản bội')).toBe('phan boi');
    expect(stripDiacritics('ế ộ ữ ẳ')).toBe('e o u a');
  });

  it('handles đ, which has no Unicode decomposition', () => {
    expect(stripDiacritics('đồng')).toBe('dong');
  });
});

describe('diacriticDiff', () => {
  it('reports accent-only differences with their positions', () => {
    const d = diacriticDiff('phan boi', 'phản bội');
    expect(d.diacriticsOnly).toBe(true);
    expect(d.positions).toEqual([2, 6]);
  });

  it('reports nothing for a substantively wrong answer', () => {
    const d = diacriticDiff('mesa', 'phản bội');
    expect(d.diacriticsOnly).toBe(false);
    expect(d.positions).toEqual([]);
  });

  it('reports nothing when the answer was right', () => {
    expect(diacriticDiff('phản bội', 'phản bội').diacriticsOnly).toBe(false);
  });

  it('does not claim accent-only when a letter is also missing', () => {
    expect(diacriticDiff('phan bo', 'phản bội').diacriticsOnly).toBe(false);
  });
});
