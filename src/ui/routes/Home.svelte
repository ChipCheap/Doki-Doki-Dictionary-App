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
  import { availableUpdate, listInstalledPacks } from '../../dictionary/install';
  import type { InstalledPack } from '../../dictionary/schema';
  import {
    absentMembers,
    applyPendingAdditions,
    countForRecipe,
    describeRecipe,
    listDecksByLanguage,
    pendingAdditions,
    quickCreateDeck,
    sessionSettingsFor,
    type DeckRow,
  } from '../../progress/deck-repo';
  import { backupIfStale, backupState, type BackupState } from '../../progress/backup';
  import BackupWarning from '../components/BackupWarning.svelte';
  import DurabilityNotice from '../components/DurabilityNotice.svelte';
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
  let pending = $state<Map<string, number>>(new Map());
  let absent = $state<Map<string, number>>(new Map());
  let backup = $state<BackupState>({ status: 'unsupported' });
  /** Language → the newer published pack version, for packs that have one. */
  let updates = $state<Map<string, string>>(new Map());
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
    // Not awaited: a network check must never hold up the deck list.
    void checkForUpdates(packs);
    byLanguage = await listDecksByLanguage();

    const next = new Map<string, DeckState>();
    const nextPending = new Map<string, number>();
    const nextAbsent = new Map<string, number>();

    for (const decks of byLanguage.values()) {
      for (const deck of decks) {
        const progress = await getWordProgress(deck.memberKeys);
        const settings = sessionSettingsFor(deck);
        nextPending.set(deck.id, (await pendingAdditions(deck)).length);
        nextAbsent.set(deck.id, (await absentMembers(deck)).length);
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
    pending = nextPending;
    absent = nextAbsent;

    // Startup cadence: back up when the newest one is over a week old. Reports
    // state either way, so a lapsed permission surfaces as the warning above.
    await backupIfStale();
    backup = await backupState();
  }

  async function checkForUpdates(installed: readonly InstalledPack[]): Promise<void> {
    const found = new Map<string, string>();
    for (const pack of installed) {
      const version = await availableUpdate(pack);
      if (version) found.set(pack.id, version);
    }
    updates = found;
  }

  async function addPending(deck: DeckRow): Promise<void> {
    await applyPendingAdditions(deck);
    await load();
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

  /**
   * Languages that have decks but no ready pack.
   *
   * Home renders one section per INSTALLED pack, so a pack whose ready flag was
   * cleared takes its language and all its decks off the screen with no
   * explanation. That happens legitimately — the version 4 upgrade clears the
   * flag on packs installed before sources were recorded — and without this the
   * only route back is the "Add a language" list, which reads as adding
   * something new rather than repairing something present. No progress is lost
   * either way; only the display is affected.
   */
  const needsRepair = $derived(
    [...byLanguage.keys()]
      .filter((language) => !packs.some((p) => p.id === language))
      .map((language) => ({
        language,
        name: CATALOG.find((c) => c.language === language)?.languageName ?? language,
        decks: byLanguage.get(language)?.length ?? 0,
      })),
  );
</script>

<div class="top">
  <h1 class="sr-only">Your decks</h1>
  <div class="menu">
    <button class="quiet" onclick={() => router.go('settings')}>Settings</button>
    <button class="quiet" onclick={() => router.go('transfer')}>Backup</button>
    <!-- Profile-wide, not per language: a snapshot covers every language at
         once, so it does not belong in a language's own section. -->
    <button class="quiet" onclick={() => router.go('snapshots')}>Snapshots</button>
    <button class="quiet" onclick={() => router.go('keyboardHelp')}>Keyboard</button>
    <button class="quiet" onclick={() => router.go('attributions')}>Attributions</button>
  </div>
</div>

<DurabilityNotice />
<BackupWarning {backup} onchange={(next) => (backup = next)} />

{#each needsRepair as repair (repair.language)}
  <div class="repair">
    <div>
      <strong>{repair.name} needs reinstalling.</strong>
      Its {repair.decks} {repair.decks === 1 ? 'deck is' : 'decks are'} safe and your progress is
      untouched — the pack itself has to be rebuilt before its words can be served again.
    </div>
    <button class="primary" onclick={() => router.go('installPack', { language: repair.language })}>
      Reinstall
    </button>
  </div>
{/each}

{#each packs as pack, i (pack.id)}
  {#if i > 0}<hr />{/if}

  <section>
    <div class="lang">
      <h2>{pack.languageName}</h2>
      <span class="code">{pack.id.toUpperCase()}</span>

      <!-- Language-scoped, so they live in the language's own header rather
           than the top menu: a selection can never span two languages. -->
      <div class="lang-actions">
        {#if (byLanguage.get(pack.id) ?? []).some((d) => (pending.get(d.id) ?? 0) > 0)}
          <button class="quiet" onclick={() => router.go('browse', { language: pack.id, updates: '1' })}>
            New from pack update
          </button>
        {/if}
        <button class="quiet" onclick={() => router.go('browse', { language: pack.id })}>
          Browse
        </button>
        <button class="quiet" onclick={() => router.go('massEdit', { language: pack.id })}>
          Mass edit
        </button>
      </div>
    </div>

    {#if updates.get(pack.id)}
      <!-- Explicit, never automatic: an update replaces the language's whole
           dictionary. Progress, decks and hidden words are untouched. -->
      <div class="update">
        <div>
          <strong>A newer {pack.languageName} pack is available.</strong>
          Your progress, decks and hidden words are kept.
          <span class="hint">{pack.packVersion} → {updates.get(pack.id)}</span>
        </div>
        <button
          class="primary"
          onclick={() => router.go('installPack', { language: pack.id, update: '1' })}
        >
          Update
        </button>
      </div>
    {/if}

    <div class="card">
      {#each byLanguage.get(pack.id) ?? [] as deck, j (deck.id)}
        {#if j > 0}<div class="sep"></div>{/if}
        {#if states.get(deck.id)}
          <DeckRowView
            {deck}
            state={states.get(deck.id)!}
            expanded={expanded === deck.id}
            pending={pending.get(deck.id) ?? 0}
            absent={absent.get(deck.id) ?? 0}
            ontoggle={() => (expanded = expanded === deck.id ? undefined : deck.id)}
            onstart={() => void start(deck)}
            onbrowse={() => router.go('browse', { language: pack.id, deck: deck.id })}
            onaddpending={() => void addPending(deck)}
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

  .repair {
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

  .update {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    border: 1px solid var(--brand);
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 10px;
    font-size: var(--size-small);
  }

  .lang-actions {
    display: flex;
    gap: 4px;
    margin-left: auto;
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
