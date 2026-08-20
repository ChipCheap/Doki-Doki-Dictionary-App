<script lang="ts">
  /**
   * S17 (first half) — the very first launch.
   *
   * Neither this screen nor InstallPack appears in ui.framework.md's inventory,
   * which begins at Home and assumes a language already exists. Without them
   * there is no route from a fresh install to a usable app.
   */
  import { CATALOG } from '../../dictionary/catalog';
  import { router } from '../router.svelte';
</script>

<h1>Pick a language</h1>
<p class="muted">
  Everything runs on this device and works offline. Your progress never leaves it, so keep a
  backup once you have some.
</p>

<div class="stack" style="margin-top: 18px">
  {#each CATALOG as entry (entry.language)}
    <button class="lang card" onclick={() => router.go('installPack', { language: entry.language })}>
      <span class="name">{entry.languageName}</span>
      <span class="code">{entry.language.toUpperCase()}</span>
      {#if entry.provisional}
        <span class="hint warn">sample words only — not yet a real dictionary</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .lang {
    display: flex;
    align-items: baseline;
    gap: 10px;
    text-align: left;
    width: 100%;
  }

  .name {
    font-size: calc(20px * var(--app-text-scale));
    font-weight: 500;
  }

  .code {
    color: var(--text-muted);
    font-size: var(--size-tiny);
    letter-spacing: 0.06em;
  }

  .warn {
    margin-left: auto;
  }
</style>
