<script lang="ts">
  /** S27 — settings, each visual control with a live preview beside it. */
  import { onMount } from 'svelte';
  import { ALL_VECTORS } from '../../domain/vectors';
  import {
    listDecks,
    sessionSettingsFor,
    updateDeckSettings,
    type DeckRow,
  } from '../../progress/deck-repo';
  import {
    FONT_CHOICES,
    getGlobalSettings,
    updateGlobalSettings,
    type GlobalSettings,
    type ThemeMode,
  } from '../../progress/settings-repo';
  import {
    backupNow,
    backupState,
    chooseFolder,
    forgetFolder,
    type BackupState,
  } from '../../progress/backup';
  import { fromDayNumber } from '../../domain/ladder';
  import { applySettings } from '../app-init';
  import BackupWarning from '../components/BackupWarning.svelte';
  import SettingPreview from '../components/SettingPreview.svelte';
  import { router } from '../router.svelte';

  interface Props {
    deckId?: string;
  }

  let { deckId = '' }: Props = $props();

  let global = $state<GlobalSettings | undefined>();
  let decks = $state<DeckRow[]>([]);
  let selected = $state<DeckRow | undefined>();
  let backup = $state<BackupState>({ status: 'unsupported' });
  let backupNote = $state<string | undefined>();

  onMount(() => void load());

  async function load(): Promise<void> {
    global = await getGlobalSettings();
    decks = await listDecks();
    selected = decks.find((d) => d.id === deckId) ?? decks[0];
    backup = await backupState();
  }

  async function pickFolder(): Promise<void> {
    backupNote = undefined;
    try {
      // Must run from the click: the picker and the permission prompt both
      // require a user gesture, which is why none of this can be automatic.
      backup = await chooseFolder();
      const wrote = await backupNow();
      backupNote = wrote.wrote ? `Backed up to ${wrote.fileName}.` : undefined;
      backup = await backupState();
    } catch {
      // A cancelled folder picker throws. Nothing was chosen and nothing broke,
      // so there is nothing to report.
      backup = await backupState();
    }
  }

  async function backupNowClicked(): Promise<void> {
    const outcome = await backupNow();
    backupNote = outcome.wrote
      ? `Backed up to ${outcome.fileName}.`
      : 'Could not back up — see above.';
    backup = await backupState();
  }

  async function patch(change: Partial<GlobalSettings>): Promise<void> {
    global = await updateGlobalSettings(change);
    applySettings(global);
  }

  async function patchDeck(change: Parameters<typeof updateDeckSettings>[1]): Promise<void> {
    if (!selected) return;
    await updateDeckSettings(selected.id, change);
    decks = await listDecks();
    selected = decks.find((d) => d.id === selected?.id);
  }

  const deckSettings = $derived(selected ? sessionSettingsFor(selected) : undefined);
</script>

<h1>Settings</h1>

{#if global}
  <div class="card stack">
    <div class="pair">
      <div>
        <label for="scale">Text size</label>
        <input
          id="scale"
          type="range"
          min="0.85"
          max="1.6"
          step="0.05"
          value={global.textScale}
          oninput={(e) => void patch({ textScale: Number(e.currentTarget.value) })}
        />
        <p class="hint">
          Tone marks are a few pixels tall and the app treats them as the whole answer, so size is
          a correctness matter here, not just comfort.
        </p>
      </div>
      <SettingPreview caption="preview" sample="phản bội" />
    </div>

    <div class="pair">
      <div>
        <label for="font">Font</label>
        <select
          id="font"
          value={global.fontFamily}
          onchange={(e) => void patch({ fontFamily: e.currentTarget.value })}
        >
          {#each FONT_CHOICES as font (font)}<option value={font}>{font}</option>{/each}
        </select>
        <p class="hint">Only faces with verified Vietnamese coverage are offered.</p>
      </div>
      <SettingPreview caption="stacked marks" font={global.fontFamily} />
    </div>

    <div class="pair">
      <div>
        <label for="theme">Appearance</label>
        <select
          id="theme"
          value={global.themeMode}
          onchange={(e) => void patch({ themeMode: e.currentTarget.value as ThemeMode })}
        >
          <option value="system">Match system</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <SettingPreview caption="current theme" sample="phản bội" />
    </div>
  </div>
{/if}

{#if selected && deckSettings}
  <h2>Deck: {selected.name}</h2>
  <div class="card stack">
    {#if decks.length > 1}
      <div>
        <label for="deck">Deck</label>
        <select
          id="deck"
          value={selected.id}
          onchange={(e) => (selected = decks.find((d) => d.id === e.currentTarget.value))}
        >
          {#each decks as deck (deck.id)}<option value={deck.id}>{deck.name}</option>{/each}
        </select>
      </div>
    {/if}

    <div>
      <label for="cap">Cards per session — {deckSettings.cardCap}</label>
      <input
        id="cap"
        type="range"
        min="5"
        max="60"
        step="5"
        value={deckSettings.cardCap}
        oninput={(e) => void patchDeck({ cardCap: Number(e.currentTarget.value) })}
      />
    </div>

    <div>
      <label for="new">New words per day — {deckSettings.newWordsPerDay}</label>
      <input
        id="new"
        type="range"
        min="0"
        max="20"
        value={deckSettings.newWordsPerDay}
        oninput={(e) => void patchDeck({ newWordsPerDay: Number(e.currentTarget.value) })}
      />
      <p class="hint">
        New words take their slots before reviews. Set this to 0 to stop taking on new vocabulary
        and work through a backlog.
      </p>
    </div>

    <div>
      <span class="label">Vectors</span>
      {#each ALL_VECTORS as vector (vector.id)}
        <label class="check">
          <input
            type="checkbox"
            checked={deckSettings.enabledVectors.includes(vector.id)}
            onchange={(e) => {
              const on = e.currentTarget.checked;
              const next = on
                ? [...deckSettings.enabledVectors, vector.id]
                : deckSettings.enabledVectors.filter((v) => v !== vector.id);
              void patchDeck({ enabledVectors: next });
            }}
          />
          {vector.label}
        </label>
      {/each}
    </div>

    <label class="check">
      <input
        type="checkbox"
        checked={deckSettings.requeryMastered}
        onchange={(e) => void patchDeck({ requeryMastered: e.currentTarget.checked })}
      />
      Keep testing mastered words occasionally
    </label>
  </div>
{/if}

<h2>Automatic backup</h2>

<BackupWarning {backup} onchange={(next) => (backup = next)} />

<div class="backup">
  {#if backup.status === 'unsupported'}
    <p class="hint">
      This browser cannot write to a folder on disk — the File System Access API is Chrome and Edge
      only. Use <button class="link" onclick={() => router.go('transfer')}>manual export</button>
      instead, and do it regularly: browser storage can be cleared, evicted, or deleted by Safari
      after seven days without a visit.
    </p>
  {:else if backup.status === 'unconfigured'}
    <p class="hint">
      Choose a folder and the app will back your profile up there after every mass-edit, and at
      startup when the last backup is over a week old. Backups that depend on remembering are not
      backups.
    </p>
    <button onclick={() => void pickFolder()}>Choose backup folder…</button>
  {:else}
    <p class="hint">
      Backing up to <strong>{backup.folderName}</strong>
      {#if backup.lastBackupDay !== undefined}
        · last backup {fromDayNumber(backup.lastBackupDay).toLocaleDateString()}
      {:else}
        · not backed up yet
      {/if}
    </p>
    <div class="row">
      <button onclick={() => void backupNowClicked()}>Back up now</button>
      <button class="quiet" onclick={() => void pickFolder()}>Change folder…</button>
      <button class="quiet" onclick={async () => (backup = await forgetFolder())}>
        Stop backing up
      </button>
    </div>
  {/if}

  {#if backupNote}<p class="hint">{backupNote}</p>{/if}
</div>

<button style="margin-top: 16px" onclick={() => router.go('home')}>Done</button>

<style>
  h2 {
    font-size: var(--size-body);
    margin: 20px 0 8px;
  }

  .backup .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .backup .link {
    border: none;
    background: none;
    padding: 0;
    font-size: inherit;
    color: var(--brand-text);
    text-decoration: underline;
  }

  .pair {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    align-items: center;
  }

  @media (min-width: 620px) {
    .pair {
      grid-template-columns: 1fr 1fr;
    }
  }

  label,
  .label {
    display: block;
    font-size: var(--size-small);
    margin-bottom: 4px;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--size-small);
  }

  .check input {
    width: auto;
  }

  input[type='range'] {
    width: 100%;
  }
</style>
