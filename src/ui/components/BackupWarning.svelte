<script lang="ts">
  /**
   * S15 — the paused-backups warning.
   *
   * A passive banner was considered and rejected: silently stopped backups are
   * exactly the failure discovered months too late, and guideline 8 requires
   * that anything affecting the user's data never fail quietly. So this states
   * plainly that backups are NOT running and carries the button that supplies
   * the user gesture the permission API requires.
   *
   * Only 'paused' is a warning. Never having chosen a folder is a choice, not a
   * failure, and is left to the settings screen.
   */
  import { backupState, resumeBackups, type BackupState } from '../../progress/backup';

  interface Props {
    /** Named `backup`, not `state` — a local `state` shadows the `$state` rune. */
    backup: BackupState;
    onchange: (next: BackupState) => void;
  }

  let { backup, onchange }: Props = $props();

  let working = $state(false);

  async function resume(): Promise<void> {
    working = true;
    try {
      onchange(await resumeBackups());
    } finally {
      working = false;
    }
  }

  async function dismissForNow(): Promise<void> {
    // Re-reads rather than hiding locally: if the permission came back by some
    // other route, the warning should simply stop applying.
    onchange(await backupState());
  }
</script>

{#if backup.status === 'paused'}
  <div class="warn">
    <div>
      <strong>Automatic backups are not running.</strong>
      The browser drops permission to write to
      {backup.folderName ? `"${backup.folderName}"` : 'your backup folder'} each time it restarts. The
      folder is remembered — only the permission needs renewing.
    </div>
    <div class="buttons">
      <button class="primary" disabled={working} onclick={() => void resume()}>
        {working ? 'Asking…' : 'Resume backups'}
      </button>
      <button class="quiet" onclick={() => void dismissForNow()}>Not now</button>
    </div>
  </div>
{/if}

<style>
  .warn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    border: 1px solid var(--incorrect);
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 14px;
    font-size: var(--size-small);
  }

  .buttons {
    display: flex;
    gap: 6px;
  }
</style>
