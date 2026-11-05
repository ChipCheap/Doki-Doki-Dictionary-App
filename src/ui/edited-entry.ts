/**
 * A dictionary entry with the user's corrections applied.
 *
 * Lives in `ui` because it joins the two halves architecture.md D1 keeps apart:
 * the entry comes from `dictionary`, the corrections from `progress`.
 */

import type { DictionaryEntry } from '../dictionary/pack-format';
import { applyEntryEdits, type EntryEdits } from '../domain/entry-edits';

export function editedEntry(entry: DictionaryEntry, edits: EntryEdits | undefined): DictionaryEntry {
  return edits ? { ...entry, ...applyEntryEdits(entry, edits) } : entry;
}
