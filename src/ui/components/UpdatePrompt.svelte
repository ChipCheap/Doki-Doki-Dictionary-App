<script lang="ts">
  /**
   * S29 — the app-update prompt.
   *
   * `registerType: 'prompt'`: a new version never replaces the running one
   * behind the user's back. It is offered here, on every screen, and a
   * declined version is remembered so a reload does not offer it again.
   *
   * Reloading mid-session is safe to offer: every grade is written the moment
   * it is made (session-store.svelte.ts), so only the position in the queue
   * is lost, never an answer.
   */
  import { pwa } from '../pwa.svelte';

  let working = $state(false);

  async function update(): Promise<void> {
    working = true;
    await pwa.applyUpdate();
  }
</script>

{#if pwa.updateReady}
  <div class="toast" role="status">
    <span>A new version of the app is ready. Updating reloads the page — your answers are saved.</span>
    <div class="buttons">
      <button class="primary" disabled={working} onclick={() => void update()}>
        {working ? 'Updating…' : 'Update'}
      </button>
      <button class="quiet" disabled={working} onclick={() => void pwa.declineUpdate()}>Not now</button>
    </div>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    width: min(560px, calc(100vw - 24px));
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: var(--size-small);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.18);
    z-index: 10;
  }

  .buttons {
    display: flex;
    gap: 6px;
  }
</style>
