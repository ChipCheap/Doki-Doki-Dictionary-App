<script lang="ts">
  /**
   * The five selection axes, shared by browse and mass-edit.
   *
   * One component because the framework says both filter on the SAME axes, and
   * two copies would be two places for them to drift apart.
   *
   * The vector control is labelled as a filter on purpose: naming a vector
   * narrows which words are selected, never which vectors get written. A vector
   * is a filter, never a scope.
   */
  import { MASTERED_LEVEL } from '../../domain/ladder';
  import type { DifficultyTier } from '../../domain/types';
  import { ALL_VECTORS } from '../../domain/vectors';
  import type { DeckRow } from '../../progress/schema';

  interface Props {
    decks: readonly DeckRow[];
    tiers: readonly DifficultyTier[];
    tags: readonly string[];
    deckId: string;
    pickedTiers: DifficultyTier[];
    pickedTags: string[];
    vectorId: string;
    levelsOn: boolean;
    minLevel: number;
    maxLevel: number;
    includeHidden: boolean;
    hiddenCount: number;
    /** Browse offers a text search; mass-edit deliberately does not. */
    search?: string;
    showSearch?: boolean;
    onchange: (patch: Record<string, unknown>) => void;
  }

  let {
    decks,
    tiers,
    tags,
    deckId,
    pickedTiers,
    pickedTags,
    vectorId,
    levelsOn,
    minLevel,
    maxLevel,
    includeHidden,
    hiddenCount,
    search = '',
    showSearch = false,
    onchange,
  }: Props = $props();

  const levels = Array.from({ length: MASTERED_LEVEL + 1 }, (_, i) => i);

  function toggle<T>(list: readonly T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }
</script>

<div class="filters">
  <div class="line">
    <label>
      <span class="hint">Deck</span>
      <select value={deckId} onchange={(e) => onchange({ deckId: e.currentTarget.value })}>
        <option value="">Whole dictionary</option>
        {#each decks as deck (deck.id)}<option value={deck.id}>{deck.name}</option>{/each}
      </select>
    </label>

    {#if showSearch}
      <label class="grow">
        <span class="hint">Search</span>
        <input
          type="search"
          value={search}
          placeholder="term or meaning"
          oninput={(e) => onchange({ search: e.currentTarget.value })}
        />
      </label>
    {/if}
  </div>

  <div class="hint">Difficulty — pick any, or none for all</div>
  <div class="chips">
    {#each tiers as tier (tier)}
      <button
        class:picked={pickedTiers.includes(tier)}
        onclick={() => onchange({ pickedTiers: toggle(pickedTiers, tier) })}
      >
        {tier}
      </button>
    {/each}
  </div>

  {#if tags.length > 0}
    <div class="hint">Topic — pick any, or none for all</div>
    <div class="chips">
      {#each tags as tag (tag)}
        <button
          class:picked={pickedTags.includes(tag)}
          onclick={() => onchange({ pickedTags: toggle(pickedTags, tag) })}
        >
          {tag}
        </button>
      {/each}
    </div>
  {/if}

  <div class="line">
    <label>
      <span class="hint">Vector — filters which words match</span>
      <select value={vectorId} onchange={(e) => onchange({ vectorId: e.currentTarget.value })}>
        <option value="">Any vector</option>
        {#each ALL_VECTORS as vector (vector.id)}
          <option value={vector.id}>{vector.label}</option>
        {/each}
      </select>
    </label>

    <label class="check">
      <input
        type="checkbox"
        checked={levelsOn}
        onchange={(e) => onchange({ levelsOn: e.currentTarget.checked })}
      />
      <span class="hint">Mastery between</span>
    </label>

    <label>
      <select
        value={minLevel}
        disabled={!levelsOn}
        onchange={(e) => onchange({ minLevel: Number(e.currentTarget.value) })}
      >
        {#each levels as level (level)}<option value={level}>{level}</option>{/each}
      </select>
    </label>
    <span class="hint">and</span>
    <label>
      <select
        value={maxLevel}
        disabled={!levelsOn}
        onchange={(e) => onchange({ maxLevel: Number(e.currentTarget.value) })}
      >
        {#each levels as level (level)}<option value={level}>{level}</option>{/each}
      </select>
    </label>
  </div>

  {#if levelsOn}
    <p class="hint">
      A word never studied counts as 0, so "0 to 2" includes words you have not met.
      {#if vectorId === ''}Any vector in range matches.{/if}
    </p>
  {/if}

  <label class="check">
    <input
      type="checkbox"
      checked={includeHidden}
      onchange={(e) => onchange({ includeHidden: e.currentTarget.checked })}
    />
    <span class="hint">
      Show hidden words{hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''}
    </span>
  </label>
</div>

<style>
  .filters {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px;
    margin: 6px 0;
  }

  .line label {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .grow {
    flex: 1;
    min-width: 160px;
  }

  .check {
    display: flex;
    flex-direction: row !important;
    align-items: center;
    gap: 6px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 4px 0 8px;
  }

  .chips button.picked {
    background: var(--brand-soft);
    border-color: var(--brand);
    color: var(--brand-text);
  }
</style>
