<script lang="ts">
  /**
   * S10 — the 0-9 mastery control, shared by the result panel and browse.
   *
   * The dropdown SELECTS a level; a separate button APPLIES it. Writing on
   * change made a consequential edit — it moves every vector of the word — feel
   * like an idle setting, and in a long browse list a stray scroll over a
   * focused `<select>` can change its value without the user meaning anything
   * by it. Two deliberate acts, and nothing is written until the second.
   *
   * maintenance.framework.md makes it an invariant that any control setting a
   * level DECLARES that it writes every vector. Making the declaration a
   * property of the component is what stops a second surface from quietly
   * omitting it — the hint cannot be left off by forgetting.
   */
  import { MASTERED_LEVEL } from '../../domain/ladder';

  interface Props {
    level: number;
    onset: (level: number) => void;
    /** Compact form for a dense list; the hint becomes the title attribute. */
    compact?: boolean;
  }

  let { level, onset, compact = false }: Props = $props();

  const levels = Array.from({ length: MASTERED_LEVEL + 1 }, (_, i) => i);
  const DECLARATION = 'Applies to every vector of this word';

  let pending = $state(0);
  /**
   * What was last written from here. The result panel does not re-render its
   * `level` prop after a write — it shows the GRADING OUTCOME, not live
   * progress — so without this, applying would give no sign it had happened.
   */
  let applied = $state<number | undefined>();

  $effect(() => {
    // Re-seed whenever the word underneath changes, which also clears any
    // stale confirmation from the previous one.
    pending = level;
    applied = undefined;
  });

  const justApplied = $derived(applied !== undefined && applied === pending);

  /**
   * Deliberately always enabled.
   *
   * Disabling it when the selection matched `level` looked tidy and was wrong
   * twice over. `level` is the grading outcome here, not the stored level, so
   * after applying 7 and then 0 the control still compared against the original
   * 1 and refused to set it back — locking the user out of the one value they
   * most likely wanted. And applying the SAME level is not always a no-op: on a
   * never-studied word it stamps the word introduced and assigns a due day,
   * which is exactly the write that makes a claimed-known word real.
   *
   * Pressing the button is the deliberate act. Re-writing two integers that
   * happen to be unchanged costs nothing; being unable to write them does.
   */
  function commit(): void {
    onset(pending);
    applied = pending;
  }
</script>

<div class="mastery" class:compact>
  {#if !compact}
    <span class="hint">Set mastery — applies to every vector of this word</span>
  {/if}

  <div class="controls">
    <select
      value={pending}
      title={compact ? DECLARATION : undefined}
      aria-label={compact ? `Mastery — ${DECLARATION.toLowerCase()}` : undefined}
      onchange={(e) => (pending = Number(e.currentTarget.value))}
    >
      {#each levels as value (value)}<option {value}>{value}</option>{/each}
    </select>

    <button title={DECLARATION} onclick={commit}>Apply</button>

    {#if justApplied}
      <span class="hint applied" role="status">set to {applied}</span>
    {/if}
  </div>
</div>

<style>
  .mastery {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .controls select {
    font-size: var(--size-small);
  }

  .compact select,
  .compact button {
    padding: 2px 6px;
    font-size: var(--size-tiny);
  }

  .applied {
    white-space: nowrap;
  }
</style>
