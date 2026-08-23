<script lang="ts">
  /**
   * One word in a browse list: term, part of speech, tier and tags, per-vector
   * level and due day, and the controls that act on it.
   *
   * Its own component rather than markup inside Browse because a second
   * word-list surface is already anticipated (the dictionary panel, see
   * framework.md's open questions) and should reuse this rather than grow a
   * parallel one that drifts.
   */
  import type { DictionaryEntry } from '../../dictionary/pack-format';
  import { displayWithArticle } from '../../domain/articles';
  import { toDayNumber } from '../../domain/ladder';
  import { levelOf } from '../../domain/maintenance';
  import type { WordProgress } from '../../domain/types';
  import { ALL_VECTORS } from '../../domain/vectors';
  import type { VectorId } from '../../domain/vectors';
  import MasteryPicker from './MasteryPicker.svelte';

  interface Props {
    entry: DictionaryEntry;
    progress?: WordProgress;
    enabledVectors: readonly VectorId[];
    hidden: boolean;
    /** Absent when browsing the whole dictionary with no deck in context. */
    inDeck?: boolean;
    onsetlevel: (level: number) => void;
    onhide: (hidden: boolean) => void;
    ondeck?: (member: boolean) => void;
  }

  let {
    entry,
    progress,
    enabledVectors,
    hidden,
    inDeck,
    onsetlevel,
    onhide,
    ondeck,
  }: Props = $props();

  const today = toDayNumber();

  /**
   * `el agua`, not `agua`. The article is part of the answer for the typed
   * vector, so browse shows the word the same way the quiz expects it — and it
   * puts the gender in front of the reader without a separate label. Falls back
   * to the bare term for languages with no gender, so Vietnamese is unaffected.
   */
  const display = $derived(
    displayWithArticle(entry.language, entry.term, entry.gender, entry.article),
  );

  const vectors = $derived(
    enabledVectors.map((id) => ({
      id,
      label: ALL_VECTORS.find((v) => v.id === id)?.label ?? id,
      level: levelOf(progress, id),
      dueDay: progress?.vectors[id]?.dueDay,
    })),
  );

  /** The highest level, which is what the single picker shows before it writes. */
  const shown = $derived(Math.max(0, ...vectors.map((v) => v.level)));

  function due(dueDay: number | undefined): string {
    if (dueDay === undefined) return 'not scheduled';
    const delta = dueDay - today;
    if (delta <= 0) return delta === 0 ? 'due today' : `${-delta}d overdue`;
    return `in ${delta}d`;
  }
</script>

<div class="row" class:hidden>
  <div class="word">
    <div class="term">
      {display}
      <span class="pos">{entry.partOfSpeech}</span>
      {#if hidden}<span class="flag">hidden</span>{/if}
    </div>
    <div class="hint meanings">{entry.meanings.join(', ')}</div>
  </div>

  <div class="tags">
    <span class="tier">{entry.difficulty}</span>
    {#each entry.contextTags as tag (tag)}<span class="tag">{tag}</span>{/each}
  </div>

  <div class="levels">
    {#each vectors as vector (vector.id)}
      <span class="vector" title={vector.label}>
        {vector.label.slice(0, 4)} <strong>{vector.level}</strong>
        <span class="hint">{due(vector.dueDay)}</span>
      </span>
    {/each}
  </div>

  <div class="controls">
    <MasteryPicker level={shown} onset={onsetlevel} compact />
    <button class="quiet" onclick={() => onhide(!hidden)}>
      {hidden ? 'Unhide' : 'Hide'}
    </button>
    {#if ondeck}
      <button class="quiet" onclick={() => ondeck(!inDeck)}>
        {inDeck ? 'Remove' : 'Add'}
      </button>
    {/if}
  </div>
</div>

<style>
  /*
   * Every column is a fixed width or a fraction — never `auto`.
   *
   * Each row is its own grid container (one per component instance), so an
   * `auto` column sizes itself from that row's content alone and the columns
   * drift out of line from row to row. Widths that do not depend on content
   * make independent grids line up as if they were one table.
   */
  .row {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) 190px 250px;
    align-items: start;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }

  .row > * {
    /* Without this a long term or a wide tag list refuses to shrink and pushes
       the later columns out, which is the same misalignment by another route. */
    min-width: 0;
  }

  .row.hidden .word {
    opacity: 0.6;
  }

  .term {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: var(--size-body);
  }

  .pos,
  .flag {
    font-size: var(--size-tiny);
    color: var(--text-muted);
  }

  .flag {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 1px 5px;
  }

  .meanings {
    margin-top: 2px;
  }

  /* Tags wrap within their column rather than widening it — a word with six
     context tags must not shove the levels and controls out of alignment. */
  .tags {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 4px;
  }

  .tier,
  .tag {
    font-size: var(--size-tiny);
    border-radius: 6px;
    padding: 2px 7px;
  }

  .tier {
    background: var(--panel);
    color: var(--text-secondary);
  }

  .tag {
    background: var(--brand-soft);
    color: var(--brand-text);
  }

  .levels {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .vector {
    display: flex;
    flex-direction: column;
    font-size: var(--size-tiny);
    color: var(--text-secondary);
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  @media (max-width: 720px) {
    .row {
      grid-template-columns: 1fr auto;
    }

    .tags,
    .levels {
      grid-column: 1 / -1;
    }
  }
</style>
