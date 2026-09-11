<script lang="ts">
  /**
   * S29 — the install prompt, stating the actual reason.
   *
   * architecture.md D7: installing is a data-safety mechanism, not decoration,
   * so the notice says what it protects rather than advertising a feature.
   * Where no install is possible it says so plainly instead — a browser that
   * can neither install nor persist is exactly where progress disappears
   * without warning (guideline 8), and staying silent there is the one choice
   * that is never right.
   */
  import { onMount } from 'svelte';
  import {
    dismissedNotices,
    dismissNotice,
    durabilityNotice,
    type DurabilityNotice,
  } from '../app-init';
  import { pwa } from '../pwa.svelte';
  import { router } from '../router.svelte';

  /** Undefined until read, so a dismissed notice never flashes on load. */
  let dismissed = $state<DurabilityNotice[] | undefined>();

  onMount(() => {
    void dismissedNotices().then((value) => (dismissed = value));
  });

  const notice = $derived(
    dismissed === undefined || pwa.persisted === undefined
      ? 'none'
      : durabilityNotice({
          installed: pwa.installed,
          persisted: pwa.persisted,
          canInstall: pwa.canInstall,
          installSettled: pwa.installSettled,
          dismissed,
        }),
  );

  async function dismiss(): Promise<void> {
    if (notice !== 'none') dismissed = await dismissNotice(notice);
  }

  async function install(): Promise<void> {
    // Cancelling the browser's dialog is the user saying "not now" — asked and
    // answered, so the banner goes. The browser's own install entry remains.
    // Accepting needs nothing here: `appinstalled` marks the app installed.
    if ((await pwa.install()) === 'dismissed') await dismiss();
  }
</script>

{#if notice === 'install'}
  <div class="notice">
    <div>
      <strong>Install Doki-Doki Dictionary.</strong>
      Installing stops the browser from clearing your progress to free up space, and gives the app
      its own window and taskbar icon.
    </div>
    <div class="buttons">
      <button class="primary" onclick={() => void install()}>Install</button>
      <button class="quiet" onclick={() => void dismiss()}>Not now</button>
    </div>
  </div>
{:else if notice === 'unprotected'}
  <div class="notice warn">
    <div>
      <strong>Your progress is not protected in this browser.</strong>
      It may clear the app's data, and it does not offer to install the app, which is what prevents
      that. Install it from Edge or Chrome instead (on iPhone or iPad: Share → Add to Home Screen),
      and export a backup regularly until then. If this notice comes back after you dismiss it, the
      browser has wiped the app's data.
    </div>
    <div class="buttons">
      <button class="primary" onclick={() => router.go('transfer')}>Export a backup</button>
      <button class="quiet" onclick={() => void dismiss()}>Dismiss</button>
    </div>
  </div>
{/if}

<style>
  .notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    border: 1px solid var(--brand);
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 14px;
    font-size: var(--size-small);
  }

  .notice.warn {
    border-color: var(--incorrect);
  }

  .buttons {
    display: flex;
    gap: 6px;
  }
</style>
