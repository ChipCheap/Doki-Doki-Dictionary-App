<script lang="ts">
  /**
   * S13 — snapshot management.
   *
   * Profile-wide, not per language: a snapshot covers progress, words and decks
   * across everything installed.
   *
   * The restore confirmation makes TWO statements, because they guard opposite
   * mistakes. Without the first, a user treats restore as a targeted undo and
   * quietly loses a week of study. Without the second, a user who believes
   * restore is one-way never uses it when they most need to.
   */
  import { onMount } from 'svelte';
  import { fromDayNumber } from '../../domain/ladder';
  import {
    deleteSnapshot,
    listSnapshots,
    restoreSnapshot,
    SNAPSHOT_RETENTION,
    type SnapshotSummary,
  } from '../../progress/snapshot-repo';
  import { router } from '../router.svelte';

  let snapshots = $state<SnapshotSummary[]>([]);
  let confirming = $state<string | undefined>();
  let working = $state(false);
  let failure = $state<string | undefined>();
  let done = $state<string | undefined>();

  onMount(() => void load());

  async function load(): Promise<void> {
    snapshots = await listSnapshots();
  }

  function when(day: number): string {
    return fromDayNumber(day).toLocaleDateString();
  }

  async function restore(id: string): Promise<void> {
    working = true;
    failure = undefined;
    done = undefined;
    try {
      const counts = await restoreSnapshot(id);
      done = `Restored ${counts.words} words, ${counts.vectorStates} vector states and ${counts.decks} decks. The state you just left is now the newest snapshot, so this can be swapped straight back.`;
      confirming = undefined;
      await load();
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : String(cause);
    } finally {
      working = false;
    }
  }

  async function remove(id: string): Promise<void> {
    await deleteSnapshot(id);
    await load();
  }
</script>

<div class="head">
  <button class="quiet" onclick={() => router.go('home')}>← Decks</button>
  <h1>Snapshots</h1>
</div>

<p class="hint">
  Taken automatically before every mass-edit. The newest {SNAPSHOT_RETENTION} are kept; older ones
  drop off on their own.
</p>

{#if failure}<p class="failed">Nothing was changed: {failure}</p>{/if}
{#if done}<p class="done">{done}</p>{/if}

<div class="card">
  {#each snapshots as snapshot, i (snapshot.id)}
    {#if i > 0}<div class="sep"></div>{/if}
    <div class="row">
      <div class="what">
        <div class="comment">{snapshot.comment}</div>
        <div class="hint">{when(snapshot.takenOn)}</div>
      </div>
      <div class="actions">
        <button class="quiet" onclick={() => (confirming = confirming === snapshot.id ? undefined : snapshot.id)}>
          Restore
        </button>
        <button class="quiet" onclick={() => void remove(snapshot.id)}>Delete</button>
      </div>
    </div>

    {#if confirming === snapshot.id}
      <div class="confirm">
        <p>
          <strong>This replaces all of your current data</strong> with the state from
          {when(snapshot.takenOn)} — every level, due day and deck. Anything since is discarded,
          <strong>including study</strong>: cards you have graded after that point lose their
          grades.
        </p>
        <p class="hint">
          Restore is meant for use shortly after the operation it protects against, not for reaching
          back into last month. The state you are leaving is kept as a snapshot, so a restore chosen
          by mistake can be swapped straight back.
        </p>
        <div class="buttons">
          <button class="primary" disabled={working} onclick={() => void restore(snapshot.id)}>
            {working ? 'Restoring…' : 'Replace my data'}
          </button>
          <button class="quiet" onclick={() => (confirming = undefined)}>Cancel</button>
        </div>
      </div>
    {/if}
  {:else}
    <p class="hint">
      No snapshots yet. One is taken automatically the first time you run a mass-edit.
    </p>
  {/each}
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }

  h1 {
    font-size: calc(20px * var(--app-text-scale));
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
  }

  .sep {
    border-top: 1px solid var(--border);
  }

  .comment {
    font-size: var(--size-body);
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .confirm {
    border: 1px solid var(--incorrect);
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 10px;
    font-size: var(--size-small);
  }

  .confirm p {
    margin-bottom: 6px;
  }

  .buttons {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .failed {
    color: var(--incorrect);
  }

  .done {
    color: var(--correct);
  }
</style>
