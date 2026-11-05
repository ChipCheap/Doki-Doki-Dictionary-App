<script lang="ts">
  /**
   * An entry's meanings and examples, each correctable by double-click.
   *
   * Works against the entry as the PACK has it plus the user's corrections, not
   * against an already-corrected copy: a correction is keyed by the original
   * meaning text or the example id, and a shortened gloss no longer carries the
   * text it is keyed by.
   *
   * Hidden lines are out of sight but one click away, so hiding something by
   * mistake costs nothing. Deleted lines are not offered back at all.
   */
  import type { DictionaryEntry } from '../../dictionary/pack-format';
  import {
    canRemoveMeaning,
    entryLines,
    withLineEdit,
    type EntryEdits,
    type EntryLine,
    type EntryPart,
    type LineEdit,
  } from '../../domain/entry-edits';
  import EntryLineEditor from './EntryLineEditor.svelte';

  interface Props {
    /** As the pack has it. */
    entry: DictionaryEntry;
    edits?: EntryEdits;
    onsave: (edits: EntryEdits) => void;
    /** After the editor closes, so the caller can hand focus back. */
    oneditclosed?: () => void;
  }

  let { entry, edits, onsave, oneditclosed }: Props = $props();

  const EDIT_HINT = 'Double-click to reword, hide or delete';

  let editing = $state<{ part: EntryPart; key: string } | undefined>();
  let showingHidden = $state(false);

  const lines = $derived(entryLines(entry, edits));
  const hiddenCount = $derived(
    [...lines.meanings, ...lines.examples].filter((line) => line.hidden).length,
  );
  const meanings = $derived(lines.meanings.filter((line) => showingHidden || !line.hidden));
  const examples = $derived(lines.examples.filter((line) => showingHidden || !line.hidden));
  const editedMeaning = $derived(
    editing?.part === 'meanings' ? meanings.find((line) => line.key === editing?.key) : undefined,
  );

  function isEditing(part: EntryPart, line: EntryLine): boolean {
    return editing?.part === part && editing.key === line.key;
  }

  function open(part: EntryPart, line: EntryLine): void {
    editing = { part, key: line.key };
  }

  /** Enter opens it from the keyboard — and must not reach the quiz, where it submits. */
  function openFromKey(event: KeyboardEvent, part: EntryPart, line: EntryLine): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    open(part, line);
  }

  function save(part: EntryPart, key: string, edit: LineEdit): void {
    onsave(withLineEdit(edits, entry.key, part, key, edit));
  }

  function close(): void {
    editing = undefined;
    oneditclosed?.();
  }
</script>

<div class="meanings">
  {#each meanings as line, i (line.key)}
    <span
      class="line"
      class:hidden-line={line.hidden}
      class:active={isEditing('meanings', line)}
      role="button"
      tabindex="0"
      title={EDIT_HINT}
      ondblclick={() => open('meanings', line)}
      onkeydown={(event) => openFromKey(event, 'meanings', line)}>{line.text}</span
    >{#if i < meanings.length - 1},&nbsp;{/if}
  {/each}
</div>

{#if editedMeaning}
  <EntryLineEditor
    line={editedMeaning}
    withTranslation={false}
    canRemove={canRemoveMeaning(entry, edits, editedMeaning.key)}
    onsave={(edit) => save('meanings', editedMeaning.key, edit)}
    onclose={close}
  />
{/if}

{#each examples as line (line.key)}
  {#if isEditing('examples', line)}
    <EntryLineEditor
      {line}
      withTranslation={true}
      canRemove={true}
      onsave={(edit) => save('examples', line.key, edit)}
      onclose={close}
    />
  {:else}
    <div
      class="example line"
      class:hidden-line={line.hidden}
      role="button"
      tabindex="0"
      title={EDIT_HINT}
      ondblclick={() => open('examples', line)}
      onkeydown={(event) => openFromKey(event, 'examples', line)}
    >
      {line.text}
      {#if line.translation}<div class="hint">{line.translation}</div>{/if}
    </div>
  {/if}
{/each}

{#if hiddenCount > 0}
  <button class="quiet reveal" onclick={() => (showingHidden = !showingHidden)}>
    {showingHidden ? 'Put away' : 'Show'}
    {hiddenCount} hidden {hiddenCount === 1 ? 'line' : 'lines'}
  </button>
{/if}

<style>
  .line {
    cursor: text;
    border-radius: 4px;
  }

  .line:hover,
  .line:focus-visible,
  .line.active {
    outline: none;
    background: var(--brand-soft);
  }

  .hidden-line {
    opacity: 0.5;
    text-decoration: line-through;
  }

  .example {
    color: var(--text-secondary);
    font-size: var(--size-small);
    margin-top: 10px;
  }

  .reveal {
    margin-top: 8px;
    font-size: var(--size-tiny);
  }
</style>
