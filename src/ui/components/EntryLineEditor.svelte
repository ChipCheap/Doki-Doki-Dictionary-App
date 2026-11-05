<script lang="ts">
  /**
   * The inline editor for one meaning or example: reword it, hide it, or delete
   * it for good.
   *
   * Hide and delete differ on purpose. A hidden line can be shown again from the
   * entry; a deleted one is gone from the app — the user asked for a way to be
   * rid of a useless line once and for all — so delete takes a second press.
   */
  import { onMount, untrack } from 'svelte';
  import type { EntryLine, LineEdit, RemovedAs } from '../../domain/entry-edits';

  interface Props {
    line: EntryLine;
    /** Examples carry a translation under the sentence; meanings do not. */
    withTranslation: boolean;
    /** False for the last meaning still shown — a word needs one to be quizzed. */
    canRemove: boolean;
    onsave: (edit: LineEdit) => void;
    onclose: () => void;
  }

  let { line, withTranslation, canRemove, onsave, onclose }: Props = $props();

  // Seeded once: the editor is created fresh for every line it opens on, and
  // must not lose what is being typed when the line it came from redraws.
  let text = $state(untrack(() => line.text));
  let translation = $state(untrack(() => line.translation ?? ''));
  let confirmingDelete = $state(false);
  let field: HTMLTextAreaElement | undefined = $state();

  const blank = $derived(text.trim().length === 0);
  const differsFromPack = $derived(
    text.trim() !== line.originalText ||
      (withTranslation && translation.trim() !== (line.originalTranslation ?? '')),
  );
  const CANNOT_REMOVE = 'A word keeps at least one meaning, or there is nothing to ask';

  onMount(() => field?.focus());

  /** Only what differs from the pack is stored, so an untouched field leaves no trace. */
  function draft(removed: RemovedAs | undefined): LineEdit {
    const newText = text.trim();
    const newTranslation = translation.trim();
    return {
      ...(newText !== line.originalText ? { text: newText } : {}),
      ...(withTranslation && newTranslation !== (line.originalTranslation ?? '')
        ? { translation: newTranslation }
        : {}),
      ...(removed ? { removed } : {}),
    };
  }

  function save(): void {
    if (blank) return;
    onsave(draft(line.hidden ? 'hidden' : undefined));
    onclose();
  }

  function toggleHidden(): void {
    onsave(draft(line.hidden ? undefined : 'hidden'));
    onclose();
  }

  function deleteForGood(): void {
    onsave({ removed: 'deleted' });
    onclose();
  }

  function restoreOriginal(): void {
    text = line.originalText;
    translation = line.originalTranslation ?? '';
  }

  /**
   * Every key stops here. The quiz listens on the window, where Enter submits an
   * answer and `m`, `r` and 1–4 act on the card — none of which may fire while
   * a correction is being typed.
   */
  function onkeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      onclose();
    } else if (event.key === 'Enter' && !event.shiftKey && event.target instanceof HTMLTextAreaElement) {
      event.preventDefault();
      save();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions — the handler only
     shields the quiz from keys typed into the fields inside. -->
<div class="editor" {onkeydown}>
  <textarea bind:this={field} bind:value={text} rows="2" aria-label="Text"></textarea>
  {#if withTranslation}
    <textarea bind:value={translation} rows="2" aria-label="Translation" placeholder="Translation"
    ></textarea>
  {/if}

  <div class="actions">
    <button class="primary" disabled={blank} onclick={save}>Save</button>
    <button
      disabled={!line.hidden && !canRemove}
      title={!line.hidden && !canRemove ? CANNOT_REMOVE : 'Hidden lines can be shown again'}
      onclick={toggleHidden}
    >
      {line.hidden ? 'Show again' : 'Hide'}
    </button>
    {#if confirmingDelete}
      <button class="danger" onclick={deleteForGood}>Delete for good</button>
    {:else}
      <button
        disabled={!canRemove && !line.hidden}
        title={!canRemove && !line.hidden ? CANNOT_REMOVE : 'Deleting cannot be undone'}
        onclick={() => (confirmingDelete = true)}
      >
        Delete
      </button>
    {/if}
    {#if differsFromPack}
      <button class="quiet" onclick={restoreOriginal}>Restore original</button>
    {/if}
    <button class="quiet" onclick={onclose}>Cancel</button>
  </div>
  {#if confirmingDelete}
    <p class="hint" role="status">Deleted lines cannot be brought back in the app.</p>
  {/if}
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }

  textarea {
    font: inherit;
    font-size: var(--size-small);
    color: var(--text-primary);
    background: var(--sunken);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 8px 10px;
    width: 100%;
    resize: vertical;
  }

  textarea:focus-visible {
    outline: none;
    border-color: var(--brand);
    box-shadow: 0 0 0 3px var(--focus-ring);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .danger {
    color: var(--incorrect);
    border-color: var(--incorrect);
  }
</style>
