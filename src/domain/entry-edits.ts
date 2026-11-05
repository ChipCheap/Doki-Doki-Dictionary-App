/**
 * Personal corrections laid over a dictionary entry: a gloss shortened, an
 * example reworded, hidden or deleted.
 *
 * The dictionary itself is never written — it is replaced wholesale by every
 * pack update. Corrections are user data instead: kept in `progress`, exported
 * with the profile, and applied on read. They are keyed by what the pack build
 * keeps stable across rebuilds, never by position:
 *  - an example by its id — a Tatoeba sentence number, or a hash of a
 *    Wiktionary example's text;
 *  - a meaning by its original text, because meanings carry no id.
 *
 * So an update that brings in new examples simply shows them, and one that
 * rewords a gloss or an example shows the new wording: the correction no longer
 * matches anything and stops applying, rather than landing on the wrong line.
 */

import type { WordKey } from './types';

/** A hidden line can be shown again; a deleted one cannot, by the user's choice. */
export type RemovedAs = 'hidden' | 'deleted';

export interface LineEdit {
  /** Replaces the meaning, or the example sentence. Absent keeps the pack's. */
  text?: string;
  /** Examples only: replaces the translation under the sentence. */
  translation?: string;
  removed?: RemovedAs;
}

export interface EntryEdits {
  wordKey: WordKey;
  /** Keyed by the meaning's ORIGINAL text. */
  meanings: Record<string, LineEdit>;
  /** Keyed by example id. */
  examples: Record<string, LineEdit>;
}

/** Which list of an entry a line belongs to. */
export type EntryPart = 'meanings' | 'examples';

interface EditableExample {
  id: string;
  text: string;
  translation?: string;
}

interface EditableEntry<E extends EditableExample = EditableExample> {
  meanings: readonly string[];
  examples: readonly E[];
}

/** One line as the editor sees it. Deleted lines never become one. */
export interface EntryLine {
  /** What the correction is keyed by: the original meaning text, or the example id. */
  key: string;
  text: string;
  translation?: string;
  /** The pack's own wording, for "restore original". */
  originalText: string;
  originalTranslation?: string;
  hidden: boolean;
  /** True when the text or translation differ from the pack. */
  reworded: boolean;
}

/**
 * Own properties only: a meaning is arbitrary text, and a gloss reading
 * `constructor` must not find `Object.prototype.constructor`.
 */
function lineEdit(record: Record<string, LineEdit>, key: string): LineEdit | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function toLine(
  key: string,
  originalText: string,
  originalTranslation: string | undefined,
  edit: LineEdit | undefined,
): EntryLine {
  const text = edit?.text ?? originalText;
  const translation = edit?.translation ?? originalTranslation;
  return {
    key,
    text,
    translation,
    originalText,
    originalTranslation,
    hidden: edit?.removed === 'hidden',
    reworded: text !== originalText || translation !== originalTranslation,
  };
}

/** Every line not deleted, corrections applied, hidden ones flagged. */
export function entryLines(
  entry: EditableEntry,
  edits: EntryEdits | undefined,
): { meanings: EntryLine[]; examples: EntryLine[] } {
  const meanings: EntryLine[] = [];
  for (const meaning of entry.meanings) {
    const edit = edits ? lineEdit(edits.meanings, meaning) : undefined;
    if (edit?.removed === 'deleted') continue;
    meanings.push(toLine(meaning, meaning, undefined, edit));
  }

  const examples: EntryLine[] = [];
  for (const example of entry.examples) {
    const edit = edits ? lineEdit(edits.examples, example.id) : undefined;
    if (edit?.removed === 'deleted') continue;
    examples.push(toLine(example.id, example.text, example.translation, edit));
  }

  return { meanings, examples };
}

/**
 * The entry as every screen should show and quiz it: hidden and deleted lines
 * gone, reworded ones replaced.
 *
 * Never leaves an entry without a meaning. A word with no meaning has nothing to
 * ask or accept, so the editor refuses to remove the last one — and should a
 * profile file arrive that removes them all anyway, the pack's meanings stand.
 */
export function applyEntryEdits<E extends EditableExample>(
  entry: EditableEntry<E>,
  edits: EntryEdits | undefined,
): { meanings: string[]; examples: E[] } {
  if (!edits) return { meanings: [...entry.meanings], examples: [...entry.examples] };

  const meanings = entry.meanings.flatMap((meaning) => {
    const edit = lineEdit(edits.meanings, meaning);
    return edit?.removed ? [] : [edit?.text ?? meaning];
  });

  const examples = entry.examples.flatMap((example) => {
    const edit = lineEdit(edits.examples, example.id);
    if (edit?.removed) return [];
    if (!edit) return [example];
    return [
      {
        ...example,
        text: edit.text ?? example.text,
        translation: edit.translation ?? example.translation,
      },
    ];
  });

  return {
    meanings: meanings.length > 0 ? meanings : [...entry.meanings],
    examples,
  };
}

/** Whether any meaning other than `key` would still be shown. */
export function canRemoveMeaning(
  entry: EditableEntry,
  edits: EntryEdits | undefined,
  key: string,
): boolean {
  return entryLines(entry, edits).meanings.some((line) => line.key !== key && !line.hidden);
}

function isEmptyEdit(edit: LineEdit): boolean {
  return edit.text === undefined && edit.translation === undefined && edit.removed === undefined;
}

/**
 * The corrections with one line's edit replaced. An edit that changes nothing
 * is dropped rather than stored, so restoring a line to the pack's wording
 * leaves no trace behind.
 */
export function withLineEdit(
  edits: EntryEdits | undefined,
  wordKey: WordKey,
  part: EntryPart,
  key: string,
  edit: LineEdit,
): EntryEdits {
  const current = edits ?? { wordKey, meanings: {}, examples: {} };
  const others = Object.fromEntries(
    Object.entries(current[part]).filter(([existing]) => existing !== key),
  );
  const record = isEmptyEdit(edit) ? others : { ...others, [key]: edit };
  return { ...current, [part]: record };
}

/** True when nothing is corrected, so the row can be removed outright. */
export function hasNoEdits(edits: EntryEdits): boolean {
  return Object.keys(edits.meanings).length === 0 && Object.keys(edits.examples).length === 0;
}
