<script lang="ts" generics="T">
  /**
   * S9 — a long list that grows as it is scrolled.
   *
   * Renders the first 200 rows and appends 200 more on reaching the bottom.
   * Virtualization is the obvious answer to ten thousand rows and is squarely
   * over the complexity ceiling (architecture.md guideline 10): it needs row
   * measurement, recycling and a scroll model. This needs a scroll handler and a
   * slice index, keeps every row reachable and in the DOM, and degrades to a
   * plain list if the handler never fires.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    items: readonly T[];
    row: Snippet<[T]>;
    /** Rendered when there is nothing at all. */
    empty?: Snippet;
    step?: number;
    /** Noun for the count line, e.g. "word". */
    noun?: string;
    /**
     * How many rows are now rendered. Callers that fetch per-row data lazily
     * need this — without it they would load for the first page and leave every
     * appended row showing defaults.
     */
    onshow?: (count: number) => void;
  }

  const DEFAULT_STEP = 200;

  let { items, row, empty, step = DEFAULT_STEP, noun = 'row', onshow }: Props = $props();

  let shown = $state(DEFAULT_STEP);

  // A new filter is a new list, so start from the top again rather than leaving
  // the user four thousand rows deep in results they did not ask for.
  $effect(() => {
    items.length;
    shown = step;
  });

  const visible = $derived(items.slice(0, shown));
  const more = $derived(Math.max(0, items.length - visible.length));

  $effect(() => {
    onshow?.(visible.length);
  });

  function onscroll(event: Event): void {
    const el = event.currentTarget as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200 && more > 0) {
      shown += step;
    }
  }
</script>

<div class="frame" {onscroll}>
  {#if items.length === 0}
    {#if empty}{@render empty()}{:else}<p class="hint">Nothing to show.</p>{/if}
  {:else}
    {#each visible as item, i (i)}
      {@render row(item)}
    {/each}

    {#if more > 0}
      <button class="quiet more" onclick={() => (shown += step)}>
        Show {Math.min(step, more)} more
      </button>
    {/if}
  {/if}
</div>

{#if items.length > 0}
  <p class="hint count">
    Showing {visible.length} of {items.length}
    {items.length === 1 ? noun : `${noun}s`}
  </p>
{/if}

<style>
  .frame {
    max-height: 60vh;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 4px 10px;
  }

  .more {
    display: block;
    width: 100%;
    margin: 8px 0;
  }

  .count {
    margin-top: 6px;
  }
</style>
