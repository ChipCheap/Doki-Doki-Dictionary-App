<script lang="ts">
  /**
   * S17 (second half) — installing a language pack.
   *
   * The one place a genuine wait is expected, so it is explicit and shows real
   * progress. Hands off to deck creation on success, so the user reaches
   * something studiable without further navigation.
   */
  import { onMount } from 'svelte';
  import { catalogEntry } from '../../dictionary/catalog';
  import { installPack, type InstallProgress, type InstallResult } from '../../dictionary/install';
  import { fetchJson } from '../../dictionary/pack-loader';
  import type { CorePack, MeaningPack } from '../../dictionary/pack-format';
  import { router } from '../router.svelte';

  interface Props {
    language: string;
    /**
     * Replacing an installed pack rather than adding a language. Same install —
     * it already replaces a language's rows and never touches progress — but
     * the screens around it differ: there is a deck list to go back to.
     */
    update?: boolean;
  }

  let { language, update = false }: Props = $props();

  let progress = $state<InstallProgress | undefined>();
  let result = $state<InstallResult | undefined>();
  let error = $state<string | undefined>();

  const entry = $derived(catalogEntry(language));

  onMount(() => void run());

  async function run(): Promise<void> {
    const target = catalogEntry(language);
    if (!target) {
      error = `No pack is bundled for "${language}".`;
      return;
    }

    try {
      const [core, meaning] = await Promise.all([
        fetchJson<CorePack>(target.corePath),
        fetchJson<MeaningPack>(target.meaningPath),
      ]);
      result = await installPack(core, meaning, (p) => (progress = p));
    } catch (cause) {
      // Loud, never silent: believing an install worked when it did not is the
      // failure that costs months before anyone notices.
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }
</script>

<h1>{entry?.languageName ?? language}</h1>

{#if error}
  <div class="card">
    <p class="bad">Could not {update ? 'update' : 'install'} this pack.</p>
    <p class="muted">{error}</p>
    {#if update}
      <p class="hint">
        Nothing is lost: until an update finishes, the language reads as not installed and can be
        installed again from Home. Progress and decks are never touched.
      </p>
    {/if}
    <button onclick={() => router.go(update ? 'home' : 'firstRun')}>Back</button>
  </div>
{:else if result}
  <div class="card stack">
    <p><strong>{result.entryCount}</strong> words {update ? 'in the updated pack' : 'installed'}.</p>
    {#if result.thinExamples > 0}
      <p class="hint">{result.thinExamples} have fewer than two example sentences.</p>
    {/if}
    {#if result.withoutMeaning.length > 0}
      <p class="hint">{result.withoutMeaning.length} skipped for having no translation.</p>
    {/if}
    {#if result.skipped.length > 0}
      <p class="hint">{result.skipped.length} skipped as malformed.</p>
    {/if}
    <div>
      <button class="primary" onclick={() => router.go('home')}>
        {update ? 'Back to decks' : 'Make a deck'}
      </button>
    </div>
  </div>
{:else}
  <div class="card">
    <p class="muted">{update ? 'Updating…' : 'Installing… this happens once.'}</p>
    <div class="bar"><div class="fill" style="width: {(progress?.fraction ?? 0) * 100}%"></div></div>
    <p class="hint">{progress?.written ?? 0} of {progress?.total ?? 0} words</p>
  </div>
{/if}

<style>
  .bar {
    height: 8px;
    background: var(--sunken);
    border-radius: 999px;
    overflow: hidden;
    margin: 10px 0 6px;
  }

  .fill {
    height: 100%;
    background: var(--brand);
    transition: width 120ms linear;
  }

  .bad {
    color: var(--incorrect);
  }
</style>
