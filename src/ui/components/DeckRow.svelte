<script lang="ts">
  /**
   * One deck in the list: name, tags, and ONE state-appropriate value.
   *
   * `Complete` and `Empty` are visibly different. Complete is the win condition
   * — the user finished what they set out to learn — and rendering it as Empty
   * would turn an accomplishment into an error message.
   */
  import type { DeckState } from '../../domain/deck-state';
  import type { DeckRow } from '../../progress/schema';
  import DeckDetail from './DeckDetail.svelte';

  interface Props {
    deck: DeckRow;
    state: DeckState;
    expanded: boolean;
    ontoggle: () => void;
    onstart: () => void;
  }

  let { deck, state, expanded, ontoggle, onstart }: Props = $props();
</script>

<div class="row">
  <div class="left">
    <button class="name" onclick={ontoggle} aria-expanded={expanded}>
      {deck.name}
      <svg class="chevron" class:up={expanded} viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M2.5 4.5 L6 8 L9.5 4.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    {#if deck.tags.length > 0}
      <div class="tags">
        {#each deck.tags as tag (tag)}<span class="tag">{tag}</span>{/each}
      </div>
    {/if}
  </div>

  <div class="right">
    {#if state.status === 'due'}
      <button class="primary" onclick={onstart}>Start session · {state.dueCount}</button>
    {:else if state.status === 'caughtUp'}
      <span class="hint">
        next in {Math.max(0, (state.nextDueDay ?? 0) - Math.floor(Date.now() / 86400000))} days
      </span>
    {:else if state.status === 'complete'}
      <span class="done">complete</span>
    {:else}
      <span class="hint">no words yet</span>
    {/if}
  </div>
</div>

{#if expanded}
  <DeckDetail {state} {onstart} />
{/if}

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
  }

  .name {
    border: none;
    padding: 0;
    font-size: var(--size-body);
    background: none;
  }

  .name {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }

  .chevron {
    width: 12px;
    height: 12px;
    color: var(--text-muted);
    transition: transform 140ms ease;
  }

  .chevron.up {
    transform: rotate(180deg);
  }

  .name:hover .chevron {
    color: var(--brand-text);
  }

  .tags {
    display: flex;
    gap: 5px;
    margin-top: 5px;
  }

  .tag {
    font-size: var(--size-tiny);
    background: var(--brand-soft);
    color: var(--brand-text);
    padding: 2px 7px;
    border-radius: 6px;
  }

  .done {
    color: var(--text-secondary);
    font-size: var(--size-small);
  }
</style>
