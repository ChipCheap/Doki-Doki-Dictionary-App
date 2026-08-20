<script lang="ts">
  /** The ladder distribution bar, revealed by clicking a deck name. */
  import type { DeckState } from '../../domain/deck-state';

  interface Props {
    state: DeckState;
    onstart: () => void;
  }

  let { state, onstart }: Props = $props();

  const d = $derived(state.distribution);
  const total = $derived(Math.max(1, d.new + d.learning + d.mature + d.mastered));
</script>

<div class="detail">
  <!-- Runs light-to-dark through the brand, so a deck visibly fills with the
       app's colour as it is mastered. -->
  <div class="bar" role="img" aria-label="Ladder distribution">
    <div style="flex: {d.new}; background: var(--bucket-new)"></div>
    <div style="flex: {d.learning}; background: var(--bucket-learning)"></div>
    <div style="flex: {d.mature}; background: var(--bucket-mature)"></div>
    <div style="flex: {d.mastered}; background: var(--bucket-mastered)"></div>
  </div>

  <div class="legend hint">
    <span><i style="background: var(--bucket-new)"></i> new {d.new}</span>
    <span><i style="background: var(--bucket-learning)"></i> learning {d.learning}</span>
    <span><i style="background: var(--bucket-mature)"></i> mature {d.mature}</span>
    <span><i style="background: var(--bucket-mastered)"></i> mastered {d.mastered}</span>
    <span class="pct">{Math.round((d.mastered / total) * 100)}% mastered</span>
  </div>

  {#if state.overdueCount > 0}
    <!-- The backlog has no automatic brake — new-words-per-day is the lever, and
         it is only usable if the pile is visible. -->
    <p class="hint">{state.overdueCount} reviews overdue.</p>
  {/if}

  <div class="actions">
    <button class="primary" onclick={onstart} disabled={state.status !== 'due'}>
      Start session
    </button>
  </div>
</div>

<style>
  .detail {
    margin-top: 10px;
  }

  .bar {
    display: flex;
    height: 22px;
    border-radius: 8px;
    overflow: hidden;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 6px;
  }

  .legend i {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  .pct {
    margin-left: auto;
  }

  .actions {
    margin-top: 12px;
  }
</style>
