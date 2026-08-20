<script lang="ts">
  /**
   * S26 — session summary.
   *
   * No streaks, no timers, no accuracy percentage: the ladder is already the
   * progress metric and a second one would only compete with it.
   */
  import { router } from '../router.svelte';
  import { session } from '../session/session-store.svelte';

  const tally = $derived(session.tally);
</script>

<h1>Session done</h1>

<div class="card grid">
  <div><span class="n">{tally.promoted}</span><span class="hint">moved up</span></div>
  <div><span class="n">{tally.held}</span><span class="hint">held</span></div>
  <div><span class="n">{tally.demoted}</span><span class="hint">moved down</span></div>
  <div><span class="n">{tally.mastered}</span><span class="hint">reached mastery</span></div>
</div>

<div style="margin-top: 16px">
  <button class="primary" onclick={() => router.go('home')}>Back to decks</button>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 16px;
    text-align: center;
  }

  .n {
    display: block;
    font-size: calc(26px * var(--app-text-scale));
    font-weight: 500;
  }
</style>
