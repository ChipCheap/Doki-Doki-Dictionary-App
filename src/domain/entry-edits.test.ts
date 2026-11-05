import { describe, expect, it } from 'vitest';
import {
  applyEntryEdits,
  canRemoveMeaning,
  entryLines,
  hasNoEdits,
  withLineEdit,
  type EntryEdits,
} from './entry-edits';

const ENTRY = {
  meanings: ['I/me, a male who is slightly older than you', 'elder brother'],
  examples: [
    { id: 'tatoeba:1', text: 'Anh ấy là bác sĩ.', translation: 'He is a doctor.', source: 'Tatoeba #1' },
    { id: 'wikt:abc', text: 'A very long example.', translation: 'Far too long.' },
  ],
};

function edits(partial: Partial<EntryEdits> = {}): EntryEdits {
  return { wordKey: 'vi:anh:pron:1', meanings: {}, examples: {}, ...partial };
}

describe('applyEntryEdits', () => {
  it('returns the entry unchanged when nothing is corrected', () => {
    expect(applyEntryEdits(ENTRY, undefined)).toEqual({
      meanings: ENTRY.meanings,
      examples: ENTRY.examples,
    });
  });

  it('replaces a reworded meaning in place', () => {
    const result = applyEntryEdits(
      ENTRY,
      edits({ meanings: { [ENTRY.meanings[0]!]: { text: 'I/me (older male)' } } }),
    );
    expect(result.meanings).toEqual(['I/me (older male)', 'elder brother']);
  });

  it('drops hidden and deleted lines alike', () => {
    const result = applyEntryEdits(
      ENTRY,
      edits({
        meanings: { 'elder brother': { removed: 'hidden' } },
        examples: { 'wikt:abc': { removed: 'deleted' } },
      }),
    );
    expect(result.meanings).toEqual([ENTRY.meanings[0]]);
    expect(result.examples.map((example) => example.id)).toEqual(['tatoeba:1']);
  });

  it('rewords an example but keeps its source', () => {
    const result = applyEntryEdits(
      ENTRY,
      edits({ examples: { 'tatoeba:1': { translation: 'He is a physician.' } } }),
    );
    expect(result.examples[0]).toEqual({
      id: 'tatoeba:1',
      text: 'Anh ấy là bác sĩ.',
      translation: 'He is a physician.',
      source: 'Tatoeba #1',
    });
  });

  it('keeps the pack meanings when a file removes every one of them', () => {
    const result = applyEntryEdits(
      ENTRY,
      edits({
        meanings: {
          [ENTRY.meanings[0]!]: { removed: 'deleted' },
          'elder brother': { removed: 'hidden' },
        },
      }),
    );
    expect(result.meanings).toEqual(ENTRY.meanings);
  });

  it('ignores a correction whose line an update no longer has', () => {
    const result = applyEntryEdits(
      ENTRY,
      edits({ examples: { 'tatoeba:999': { removed: 'deleted' } } }),
    );
    expect(result.examples).toEqual(ENTRY.examples);
  });

  it('does not mistake an inherited property for a correction', () => {
    const entry = { meanings: ['constructor'], examples: [] };
    expect(applyEntryEdits(entry, edits()).meanings).toEqual(['constructor']);
  });
});

describe('entryLines', () => {
  it('leaves out deleted lines and flags hidden and reworded ones', () => {
    const lines = entryLines(
      ENTRY,
      edits({
        meanings: { 'elder brother': { removed: 'hidden' } },
        examples: {
          'tatoeba:1': { text: 'Anh là bác sĩ.' },
          'wikt:abc': { removed: 'deleted' },
        },
      }),
    );

    expect(lines.meanings.map((line) => [line.key, line.hidden])).toEqual([
      [ENTRY.meanings[0], false],
      ['elder brother', true],
    ]);
    expect(lines.examples).toHaveLength(1);
    expect(lines.examples[0]).toMatchObject({
      text: 'Anh là bác sĩ.',
      originalText: 'Anh ấy là bác sĩ.',
      reworded: true,
    });
  });
});

describe('canRemoveMeaning', () => {
  it('refuses to remove the last shown meaning', () => {
    const oneLeft = edits({ meanings: { 'elder brother': { removed: 'hidden' } } });
    expect(canRemoveMeaning(ENTRY, oneLeft, ENTRY.meanings[0]!)).toBe(false);
    expect(canRemoveMeaning(ENTRY, undefined, ENTRY.meanings[0]!)).toBe(true);
  });
});

describe('withLineEdit', () => {
  it('creates the corrections for a word that had none', () => {
    const result = withLineEdit(undefined, 'w', 'examples', 'tatoeba:1', { removed: 'hidden' });
    expect(result).toEqual({ wordKey: 'w', meanings: {}, examples: { 'tatoeba:1': { removed: 'hidden' } } });
  });

  it('drops an edit that changes nothing, leaving no trace', () => {
    const before = withLineEdit(undefined, 'w', 'meanings', 'elder brother', { text: 'brother' });
    const after = withLineEdit(before, 'w', 'meanings', 'elder brother', {});
    expect(hasNoEdits(after)).toBe(true);
  });
});
