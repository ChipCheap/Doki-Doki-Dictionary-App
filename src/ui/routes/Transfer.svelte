<script lang="ts">
  /**
   * S28 — export and import.
   *
   * This is disaster recovery, not just portability: browser storage can be
   * cleared, evicted, or deleted by Safari after seven days of no visits. It is
   * the only thing between a tidied browser and months of lost work.
   *
   * Import states exactly what will happen before it happens, and never
   * completes silently — believing an import fired when it did not is the
   * failure that costs months before anyone notices.
   */
  import {
    countsOf,
    exportProfile,
    importProfile,
    parseProfile,
    suggestedFileName,
    toFileContents,
    type ProfileExport,
    type TransferCounts,
  } from '../../progress/transfer';
  import { router } from '../router.svelte';

  let pending = $state<ProfileExport | undefined>();
  let done = $state<TransferCounts | undefined>();
  let error = $state<string | undefined>();
  let exported = $state(false);

  async function save(): Promise<void> {
    const profile = await exportProfile();
    const blob = new Blob([toFileContents(profile)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedFileName();
    link.click();
    URL.revokeObjectURL(url);

    exported = true;
  }

  async function choose(event: Event): Promise<void> {
    error = undefined;
    done = undefined;
    pending = undefined;

    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      pending = parseProfile(JSON.parse(await file.text()));
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  async function apply(): Promise<void> {
    if (!pending) return;
    try {
      done = await importProfile(pending);
      pending = undefined;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }
</script>

<h1>Backup</h1>

<div class="card stack">
  <div>
    <h2>Save a copy</h2>
    <p class="muted">
      Everything you have learned — levels, due days, decks and settings. The dictionary is not
      included; it comes back from the pack.
    </p>
    <button class="primary" onclick={() => void save()}>Export profile</button>
    {#if exported}<p class="hint">Saved to your downloads.</p>{/if}
  </div>
</div>

<div class="card stack" style="margin-top: 12px">
  <div>
    <h2>Restore</h2>
    <p class="warn">This replaces everything on this device. It cannot be undone.</p>
    <input type="file" accept="application/json" onchange={(e) => void choose(e)} />
  </div>

  {#if error}
    <p class="bad">{error}</p>
  {/if}

  {#if pending}
    {@const counts = countsOf(pending)}
    <div class="confirm">
      <p>
        This file holds <strong>{counts.words}</strong> words,
        <strong>{counts.vectorStates}</strong> saved levels and
        <strong>{counts.decks}</strong> decks{pending.exportedAt
          ? `, saved ${pending.exportedAt.slice(0, 10)}`
          : ''}.
      </p>
      <p class="warn">Your current progress will be erased and replaced.</p>
      <button class="primary" onclick={() => void apply()}>Replace my progress</button>
      <button onclick={() => (pending = undefined)}>Cancel</button>
    </div>
  {/if}

  {#if done}
    <p class="ok">
      Restored {done.words} words, {done.vectorStates} levels and {done.decks} decks.
    </p>
  {/if}
</div>

<button style="margin-top: 16px" onclick={() => router.go('home')}>Done</button>

<style>
  h2 {
    font-size: var(--size-body);
    margin-bottom: 4px;
  }

  .warn {
    color: var(--incorrect);
    font-size: var(--size-small);
  }

  .bad {
    color: var(--incorrect);
  }

  .ok {
    color: var(--correct);
  }

  .confirm {
    border-top: 1px solid var(--border);
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
</style>
