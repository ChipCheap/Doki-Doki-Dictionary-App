<script lang="ts">
  /**
   * S11 — browse.
   *
   * A word list over a deck or the whole dictionary for ONE language, filterable
   * on the same axes as mass-edit, showing per-vector levels and due days. It is
   * the entry point for single-word edits and the place hidden words stay
   * visible.
   *
   * Progress is loaded two different ways on purpose — see `browse-query.ts`.
   */
  import { onMount } from 'svelte';
  import { availableTags, availableTiers } from '../../dictionary/queries';
  import type { DictionaryEntry } from '../../dictionary/pack-format';
  import { toDayNumber } from '../../domain/ladder';
  import type { ProgressFilter } from '../../domain/maintenance';
  import type { DifficultyTier, WordKey, WordProgress } from '../../domain/types';
  import {
    addWordsToDeck,
    listDecksByLanguage,
    pendingAdditions,
    removeWordsFromDeck,
    sessionSettingsFor,
  } from '../../progress/deck-repo';
  import {
    setHidden,
    setLevelForAllVectors,
  } from '../../progress/progress-repo';
  import type { DeckRow } from '../../progress/schema';
  import { DEFAULT_DECK_SETTINGS } from '../../progress/settings-repo';
  import FilterPanel from '../components/FilterPanel.svelte';
  import IncrementalList from '../components/IncrementalList.svelte';
  import WordRowView from '../components/WordRow.svelte';
  import { PAGE_SIZE, progressForPage, resolveSelection } from '../browse-query';
  import { router } from '../router.svelte';

  interface Props {
    language: string;
    /** Pre-selected deck, when arriving from a deck's "browse words". */
    deck?: string;
    /** Opens filtered to words a pack update newly matches. */
    updates?: boolean;
  }

  let { language, deck = '', updates = false }: Props = $props();

  let decks = $state<DeckRow[]>([]);
  let tiers = $state<DifficultyTier[]>([]);
  let tags = $state<string[]>([]);

  // Seeded from the `deck` prop in `init`, not here: reading a prop inside a
  // `$state` initializer captures only its first value.
  let deckId = $state('');
  let pickedTiers = $state<DifficultyTier[]>([]);
  let pickedTags = $state<string[]>([]);
  let vectorId = $state('');
  let levelsOn = $state(false);
  let minLevel = $state(0);
  let maxLevel = $state(9);
  let includeHidden = $state(false);
  let search = $state('');

  let matches = $state<DictionaryEntry[]>([]);
  let hiddenExcluded = $state(0);
  let progress = $state<Map<WordKey, WordProgress>>(new Map());
  let hiddenKeys = $state<Set<WordKey>>(new Set());
  let updateKeys = $state<WordKey[]>([]);
  let visibleCount = $state(PAGE_SIZE);
  let loading = $state(true);
  let failure = $state<string | undefined>();

  const selectedDeck = $derived(decks.find((d) => d.id === deckId));
  const deckMemberKeys = $derived(new Set(selectedDeck?.memberKeys ?? []));

  const enabledVectors = $derived(
    selectedDeck
      ? sessionSettingsFor(selectedDeck).enabledVectors
      : DEFAULT_DECK_SETTINGS.enabledVectors,
  );

  onMount(() => void init());

  async function init(): Promise<void> {
    if (deck && !deckId) deckId = deck;
    const byLanguage = await listDecksByLanguage();
    decks = byLanguage.get(language) ?? [];
    tiers = await availableTiers(language);
    tags = await availableTags(language);

    if (updates) {
      const keys = new Set<WordKey>();
      for (const row of decks) {
        for (const key of await pendingAdditions(row)) keys.add(key);
      }
      updateKeys = [...keys];
    }

    await refresh();
  }

  async function refresh(): Promise<void> {
    loading = true;
    failure = undefined;
    try {
      const progressFilter: ProgressFilter = {
        includeHidden,
        ...(vectorId ? { vectorId } : {}),
        ...(levelsOn ? { levels: { min: minLevel, max: maxLevel } } : {}),
      };

      // A deck restricts to its members; the update view restricts to the keys a
      // pack update newly matched. Both are just an explicit key set.
      const keys = updates
        ? updateKeys
        : selectedDeck
          ? selectedDeck.memberKeys
          : undefined;

      const result = await resolveSelection({
        browse: {
          language,
          ...(keys !== undefined ? { keys } : {}),
          ...(pickedTiers.length > 0 ? { difficulties: pickedTiers } : {}),
          ...(pickedTags.length > 0 ? { contextTags: pickedTags } : {}),
          ...(search.trim() ? { search } : {}),
        },
        progress: progressFilter,
        enabledVectors,
      });

      matches = result.matches;
      hiddenExcluded = result.hiddenExcluded;
      hiddenKeys = result.hidden;
      await loadVisibleProgress(visibleCount);
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading = false;
    }
  }

  /**
   * Progress for the rows actually rendered, refetched as the list grows.
   *
   * The whole point of paging here is not reading ten thousand words' progress
   * to show two hundred rows.
   */
  async function loadVisibleProgress(count: number): Promise<void> {
    visibleCount = Math.max(count, PAGE_SIZE);
    progress = await progressForPage(matches.slice(0, visibleCount));
  }

  function apply(patch: Record<string, unknown>): void {
    if ('deckId' in patch) deckId = patch.deckId as string;
    if ('pickedTiers' in patch) pickedTiers = patch.pickedTiers as DifficultyTier[];
    if ('pickedTags' in patch) pickedTags = patch.pickedTags as string[];
    if ('vectorId' in patch) vectorId = patch.vectorId as string;
    if ('levelsOn' in patch) levelsOn = patch.levelsOn as boolean;
    if ('minLevel' in patch) minLevel = patch.minLevel as number;
    if ('maxLevel' in patch) maxLevel = patch.maxLevel as number;
    if ('includeHidden' in patch) includeHidden = patch.includeHidden as boolean;
    if ('search' in patch) search = patch.search as string;
    void refresh();
  }

  async function setLevel(key: WordKey, level: number): Promise<void> {
    await setLevelForAllVectors(key, level, enabledVectors, toDayNumber());
    await refresh();
  }

  async function hide(key: WordKey, hidden: boolean): Promise<void> {
    await setHidden(key, hidden);
    await refresh();
  }

  async function membership(key: WordKey, member: boolean): Promise<void> {
    if (!selectedDeck) return;
    if (member) await addWordsToDeck(selectedDeck.id, [key]);
    else await removeWordsFromDeck(selectedDeck.id, [key]);
    await init();
  }
</script>

<div class="head">
  <button class="quiet" onclick={() => router.go('home')}>← Decks</button>
  <h1>
    {#if updates}New from pack update{:else if selectedDeck}{selectedDeck.name}{:else}Dictionary{/if}
  </h1>
</div>

{#if updates}
  <p class="hint">
    Words that now match a deck's recipe but are not in that deck yet. Adding them all at once is
    on the deck itself; here you can look through them and add individually.
  </p>
{/if}

<FilterPanel
  {decks}
  {tiers}
  {tags}
  {deckId}
  {pickedTiers}
  {pickedTags}
  {vectorId}
  {levelsOn}
  {minLevel}
  {maxLevel}
  {includeHidden}
  hiddenCount={hiddenExcluded}
  {search}
  showSearch
  onchange={apply}
/>

{#if failure}
  <p class="failed">{failure}</p>
{:else if loading}
  <p class="hint">Loading…</p>
{:else}
  <IncrementalList items={matches} noun="word" onshow={(n) => void loadVisibleProgress(n)}>
    {#snippet row(entry: DictionaryEntry)}
      <WordRowView
        {entry}
        progress={progress.get(entry.key)}
        {enabledVectors}
        hidden={hiddenKeys.has(entry.key)}
        inDeck={deckMemberKeys.has(entry.key)}
        onsetlevel={(level) => void setLevel(entry.key, level)}
        onhide={(value) => void hide(entry.key, value)}
        ondeck={selectedDeck ? (member) => void membership(entry.key, member) : undefined}
      />
    {/snippet}

    {#snippet empty()}
      <p class="hint">No words match these filters.</p>
    {/snippet}
  </IncrementalList>
{/if}

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

  .failed {
    color: var(--incorrect);
  }
</style>
