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
  import { applySettings } from '../app-init';
  import SettingPreview from '../components/SettingPreview.svelte';
  import { router } from '../router.svelte';

  interface Props {
    deckId?: string;
  }

  let { deckId = '' }: Props = $props();

  let global = $state<GlobalSettings | undefined>();
  let decks = $state<DeckRow[]>([]);
  let selected = $state<DeckRow | undefined>();

  onMount(() => void load());

  async function load(): Promise<void> {
    global = await getGlobalSettings();
    decks = await listDecks();
    selected = decks.find((d) => d.id === deckId) ?? decks[0];
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

<button style="margin-top: 16px" onclick={() => router.go('home')}>Done</button>

<style>
  h2 {
    font-size: var(--size-body);
    margin: 20px 0 8px;
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
