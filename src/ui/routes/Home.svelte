<script lang="ts">
  /**
   * S18 — Home.
   *
   * Every installed language at once, as stacked sections in a stable order:
   * header, that language's deck list in its own box, then a rule. A user
   * studying two languages sees both days' work without navigating, and the
   * layout reflows on mobile without a second design.
   *
   * No flag icons — Windows ships no flag glyphs, so they degrade to letter
   * pairs on the primary platform anyway.
   */
  import { onMount } from 'svelte';
  import { computeDeckState, type DeckState } from '../../domain/deck-state';
  import { CATALOG } from '../../dictionary/catalog';
  import { listInstalledPacks } from '../../dictionary/install';
  import type { InstalledPack } from '../../dictionary/schema';
  import {
    countForRecipe,
    describeRecipe,
    listDecksByLanguage,
    quickCreateDeck,
    sessionSettingsFor,
    type DeckRow,
  } from '../../progress/deck-repo';
  import type { DeckRecipe } from '../../progress/schema';
  import type { DifficultyTier } from '../../domain/types';
  import { getWordProgress } from '../../progress/progress-repo';
  import { toDayNumber } from '../../domain/ladder';
  import { availableTags, availableTiers } from '../../dictionary/queries';
  import DeckRowView from '../components/DeckRow.svelte';
  import { router } from '../router.svelte';
  import { session } from '../session/session-store.svelte';

  let packs = $state<InstalledPack[]>([]);
  let byLanguage = $state<Map<string, DeckRow[]>>(new Map());
  let states = $state<Map<string, DeckState>>(new Map());
  let expanded = $state<string | undefined>();
  let creatingFor = $state<string | undefined>();
  let tiers = $state<DifficultyTier[]>([]);
  let tags = $state<string[]>([]);

  // The recipe being assembled. Within a group the terms are OR'd; the two
  // groups are AND'd — so "advanced" + "finance" is advanced finance words.
  let pickedTiers = $state<DifficultyTier[]>([]);
  let pickedTags = $state<string[]>([]);
  let previewCount = $state(0);

  onMount(() => void load());

  async function load(): Promise<void> {
    packs = await listInstalledPacks();
    byLanguage = await listDecksByLanguage();

    const next = new Map<string, DeckState>();
    for (const decks of byLanguage.values()) {
      for (const deck of decks) {
        const progress = await getWordProgress(deck.memberKeys);
        const settings = sessionSettingsFor(deck);
        next.set(
          deck.id,
          computeDeckState({
            memberKeys: deck.memberKeys,
            progress,
            enabledVectors: settings.enabledVectors,
            requeryMastered: settings.requeryMastered,
            today: toDayNumber(),
            // The same cap and budget the session will use, so the number on
            // the button is what the session actually deals.
            cardCap: settings.cardCap,
            newWordsPerDay: settings.newWordsPerDay,
          }),
        );
      }
    }
    states = next;
  }

  async function openCreate(language: string): Promise<void> {
    creatingFor = creatingFor === language ? undefined : language;
    pickedTiers = [];
    pickedTags = [];
    if (creatingFor) {
      tiers = await availableTiers(language);
      tags = await availableTags(language);
      await refreshPreview();
    }
  }

  const recipe = $derived<DeckRecipe>({
    difficulties: pickedTiers,
    contextTags: pickedTags,
    includeSequence: false,
  });

  async function refreshPreview(): Promise<void> {
    if (!creatingFor) return;
    previewCount = await countForRecipe(creatingFor, recipe);
  }

  function toggleTier(tier: DifficultyTier): void {
    pickedTiers = pickedTiers.includes(tier)
      ? pickedTiers.filter((t) => t !== tier)
      : [...pickedTiers, tier];
    void refreshPreview();
  }

  function toggleTag(tag: string): void {
    pickedTags = pickedTags.includes(tag)
      ? pickedTags.filter((t) => t !== tag)
      : [...pickedTags, tag];
    void refreshPreview();
  }

  let createError = $state<string | undefined>();

  async function create(language: string): Promise<void> {
    createError = undefined;
    try {
      await quickCreateDeck({
        language,
        name: describeRecipe(recipe),
        recipe,
        tags: [...pickedTiers, ...pickedTags],
      });
      creatingFor = undefined;
      await load();
    } catch (cause) {
      // Never swallow this: a create that silently does nothing is exactly the
      // failure architecture.md guideline 8 exists to prevent.
      createError = cause instanceof Error ? cause.message : String(cause);
    }
  }

  async function start(deck: DeckRow): Promise<void> {
    await session.start(deck);
    router.go(session.newCards.length > 0 ? 'newVocabulary' : 'quiz');
  }

  /** Languages in the catalogue that are not installed yet. */
  const missing = $derived(CATALOG.filter((c) => !packs.some((p) => p.id === c.language)));
</script>

<div class="top">
  <h1 class="sr-only">Your decks</h1>
  <div class="menu">
    <button class="quiet" onclick={() => router.go('settings')}>Settings</button>
    <button class="quiet" onclick={() => router.go('transfer')}>Backup</button>
    <button class="quiet" onclick={() => router.go('keyboardHelp')}>Keyboard</button>
  </div>
</div>

{#each packs as pack, i (pack.id)}
  {#if i > 0}<hr />{/if}

  <section>
    <div class="lang">
      <h2>{pack.languageName}</h2>
      <span class="code">{pack.id.toUpperCase()}</span>
    </div>

    <div class="card">
      {#each byLanguage.get(pack.id) ?? [] as deck, j (deck.id)}
        {#if j > 0}<div class="sep"></div>{/if}
        {#if states.get(deck.id)}
          <DeckRowView
            {deck}
            state={states.get(deck.id)!}
            expanded={expanded === deck.id}
            ontoggle={() => (expanded = expanded === deck.id ? undefined : deck.id)}
            onstart={() => void start(deck)}
          />
        {/if}
      {:else}
        <p class="hint">No decks yet for this language.</p>
      {/each}

      <div class="create">
        <button class="quiet" onclick={() => void openCreate(pack.id)}>
          {creatingFor === pack.id ? 'Cancel' : '+ New deck'}
        </button>

        {#if creatingFor === pack.id}
          <div class="options">
            <div class="hint">Difficulty — pick any, or none for all</div>
            <div class="chips">
              {#each tiers as tier (tier)}
                <button class:picked={pickedTiers.includes(tier)} onclick={() => toggleTier(tier)}>
                  {tier}
                </button>
              {/each}
            </div>

            {#if tags.length > 0}
              <div class="hint">Topic — pick any, or none for all</div>
              <div class="chips">
                {#each tags as tag (tag)}
                  <button class:picked={pickedTags.includes(tag)} onclick={() => toggleTag(tag)}>
                    {tag}
                  </button>
                {/each}
              </div>
            {/if}

            <div class="confirm">
              <div>
                <strong>{describeRecipe(recipe)}</strong>
                <div class="hint">
                  {previewCount}
                  {previewCount === 1 ? 'word' : 'words'}
                  {#if pickedTiers.length > 0 && pickedTags.length > 0}
                    · must match a difficulty <em>and</em> a topic
                  {/if}
                </div>
              </div>
              <button class="primary" disabled={previewCount === 0} onclick={() => void create(pack.id)}>
                Create deck
              </button>
            </div>

            {#if createError}
              <p class="failed">Could not create that deck: {createError}</p>
            {/if}

            <p class="hint">
              Numbers, weekdays and months are left out — they are learned in order, not jumbled
              into a quiz.
            </p>
          </div>
        {/if}
      </div>
    </div>
  </section>
{:else}
  <p class="hint">No language packs installed.</p>
{/each}

{#if missing.length > 0}
  <!-- Reachable at ANY time, not only on a fresh profile: the first-run picker
       used to be the only route to an install, so a second language could never
       be added once the first one existed. -->
  <hr />
  <section>
    <h2 class="add">Add a language</h2>
    <div class="chips">
      {#each missing as entry (entry.language)}
        <button onclick={() => router.go('installPack', { language: entry.language })}>
          {entry.languageName}
        </button>
      {/each}
    </div>
  </section>
{/if}

<style>
  .top {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 14px;
  }

  .menu {
    display: flex;
    gap: 4px;
  }

  .lang {
    display: flex;
    align-items: baseline;
    gap: 9px;
    margin-bottom: 8px;
  }

  h2 {
    font-size: calc(22px * var(--app-text-scale));
  }

  h2.add {
    font-size: var(--size-body);
    margin-bottom: 8px;
  }

  .code {
    color: var(--text-muted);
    font-size: var(--size-tiny);
    letter-spacing: 0.06em;
  }

  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 18px 0 16px;
  }

  .sep {
    border-top: 1px solid var(--border);
  }

  .create {
    border-top: 1px solid var(--border);
    margin-top: 8px;
    padding-top: 8px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 4px 0 10px;
  }

  .chips :global(button.picked) {
    background: var(--brand-soft);
    border-color: var(--brand);
    color: var(--brand-text);
  }

  .failed {
    color: var(--incorrect);
    font-size: var(--size-small);
  }

  .confirm {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
    margin-top: 4px;
  }
</style>
