<script lang="ts">
  /**
   * S12 — mass-edit.
   *
   * A rare corrective tool, and the surface says so rather than presenting it as
   * routine. Four stages in one screen: select, choose the operation, read the
   * summary, write the comment.
   *
   * The summary and the write come from ONE planned write set, so the preview
   * cannot describe something other than what commits. The order puts the
   * summary before the comment on purpose — the damage estimate should be read
   * before the user is asked to describe what they are doing.
   */
  import { onMount } from 'svelte';
  import { availableTags, availableTiers } from '../../dictionary/queries';
  import { MASTERED_LEVEL, toDayNumber } from '../../domain/ladder';
  import {
    planMassEdit,
    staggerRate,
    type MassEditOperation,
    type MassEditPlan,
    type ProgressFilter,
  } from '../../domain/maintenance';
  import type { DifficultyTier } from '../../domain/types';
  import { backupNow } from '../../progress/backup';
  import { listDecksByLanguage, sessionSettingsFor } from '../../progress/deck-repo';
  import { applyMassEdit, getAllWordProgress } from '../../progress/progress-repo';
  import type { DeckRow } from '../../progress/schema';
  import { DEFAULT_DECK_SETTINGS } from '../../progress/settings-repo';
  import FilterPanel from '../components/FilterPanel.svelte';
  import { resolveSelection, toSelectable } from '../browse-query';
  import { router } from '../router.svelte';

  interface Props {
    language: string;
  }

  let { language }: Props = $props();

  let decks = $state<DeckRow[]>([]);
  let tiers = $state<DifficultyTier[]>([]);
  let tags = $state<string[]>([]);

  let deckId = $state('');
  let pickedTiers = $state<DifficultyTier[]>([]);
  let pickedTags = $state<string[]>([]);
  let vectorId = $state('');
  let levelsOn = $state(false);
  let minLevel = $state(0);
  let maxLevel = $state(9);
  let includeHidden = $state(false);

  let operation = $state<'setLevel' | 'hide' | 'unhide' | 'addDeck' | 'removeDeck'>('setLevel');
  let targetLevel = $state(5);
  let targetDeckId = $state('');

  let comment = $state('');
  let plan = $state<MassEditPlan | undefined>();
  let hiddenExcluded = $state(0);
  let working = $state(false);
  let failure = $state<string | undefined>();
  let done = $state<string | undefined>();

  const levels = Array.from({ length: MASTERED_LEVEL + 1 }, (_, i) => i);

  const selectedDeck = $derived(decks.find((d) => d.id === deckId));
  const targetDeck = $derived(decks.find((d) => d.id === targetDeckId));

  const enabledVectors = $derived(
    selectedDeck
      ? sessionSettingsFor(selectedDeck).enabledVectors
      : DEFAULT_DECK_SETTINGS.enabledVectors,
  );

  const cardCap = $derived(
    selectedDeck ? sessionSettingsFor(selectedDeck).cardCap : DEFAULT_DECK_SETTINGS.cardCap,
  );

  const needsTargetDeck = $derived(operation === 'addDeck' || operation === 'removeDeck');
  const ready = $derived(
    plan !== undefined &&
      plan.wordsAffected > 0 &&
      comment.trim().length > 0 &&
      (!needsTargetDeck || targetDeckId !== '') &&
      !working,
  );

  onMount(() => void init());

  async function init(): Promise<void> {
    const byLanguage = await listDecksByLanguage();
    decks = byLanguage.get(language) ?? [];
    tiers = await availableTiers(language);
    tags = await availableTags(language);
    await replan();
  }

  function operationValue(): MassEditOperation {
    switch (operation) {
      case 'setLevel':
        return { kind: 'setLevel', level: targetLevel };
      case 'hide':
        return { kind: 'setHidden', hidden: true };
      case 'unhide':
        return { kind: 'setHidden', hidden: false };
      case 'addDeck':
        return { kind: 'deckMembership', action: 'add', deckId: targetDeckId };
      default:
        return { kind: 'deckMembership', action: 'remove', deckId: targetDeckId };
    }
  }

  async function replan(): Promise<void> {
    // Deliberately does NOT clear `done`: committing re-plans to refresh the
    // numbers, and wiping the result here would erase the only confirmation the
    // user gets that anything happened.
    failure = undefined;
    try {
      const progressFilter: ProgressFilter = {
        // Unhiding is the one operation whose targets are hidden by definition,
        // so the filter cannot exclude them or it would select nothing.
        includeHidden: includeHidden || operation === 'unhide',
        ...(vectorId ? { vectorId } : {}),
        ...(levelsOn ? { levels: { min: minLevel, max: maxLevel } } : {}),
      };

      const selection = await resolveSelection({
        browse: {
          language,
          ...(selectedDeck ? { keys: selectedDeck.memberKeys } : {}),
          ...(pickedTiers.length > 0 ? { difficulties: pickedTiers } : {}),
          ...(pickedTags.length > 0 ? { contextTags: pickedTags } : {}),
        },
        progress: progressFilter,
        enabledVectors,
      });

      hiddenExcluded = selection.hiddenExcluded;

      plan = planMassEdit({
        words: toSelectable(selection.matches),
        progress: await getAllWordProgress(),
        operation: operationValue(),
        enabledVectors,
        today: toDayNumber(),
        rate: staggerRate(cardCap),
      });
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : String(cause);
    }
  }

  function apply(patch: Record<string, unknown>): void {
    // A changed selection makes the previous result stale, so it goes here
    // rather than in `replan`, which commit also calls.
    done = undefined;
    if ('deckId' in patch) deckId = patch.deckId as string;
    if ('pickedTiers' in patch) pickedTiers = patch.pickedTiers as DifficultyTier[];
    if ('pickedTags' in patch) pickedTags = patch.pickedTags as string[];
    if ('vectorId' in patch) vectorId = patch.vectorId as string;
    if ('levelsOn' in patch) levelsOn = patch.levelsOn as boolean;
    if ('minLevel' in patch) minLevel = patch.minLevel as number;
    if ('maxLevel' in patch) maxLevel = patch.maxLevel as number;
    if ('includeHidden' in patch) includeHidden = patch.includeHidden as boolean;
    void replan();
  }

  async function commit(): Promise<void> {
    if (!plan || !ready) return;
    working = true;
    failure = undefined;
    try {
      const result = await applyMassEdit(plan, comment, toDayNumber());
      // The other backup trigger. Not about age — about the operation.
      const backup = await backupNow();
      comment = '';
      await replan();
      done =
        `${result.wordsAffected} words changed. A snapshot was taken first, so this can be undone.` +
        (backup.wrote ? ` Backed up to ${backup.fileName}.` : '');
    } catch (cause) {
      // Never swallowed: the user must never believe an edit happened when it
      // did not (architecture.md guidelines 8 and 9).
      failure = cause instanceof Error ? cause.message : String(cause);
    } finally {
      working = false;
    }
  }
</script>

<div class="head">
  <button class="quiet" onclick={() => router.go('home')}>← Decks</button>
  <h1>Mass edit</h1>
</div>

<div class="warn">
  <strong>This changes many words at once.</strong>
  Most people never need it. A snapshot is taken before the change, and restoring it swaps back —
  but check the numbers below before committing, especially anything moving <em>down</em>.
</div>

<h2>1 · Select</h2>
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
  onchange={apply}
/>

<h2>2 · Operation</h2>
<div class="ops">
  <select value={operation} onchange={(e) => { operation = e.currentTarget.value as typeof operation; void replan(); }}>
    <option value="setLevel">Set mastery</option>
    <option value="hide">Hide</option>
    <option value="unhide">Unhide</option>
    <option value="addDeck">Add to deck</option>
    <option value="removeDeck">Remove from deck</option>
  </select>

  {#if operation === 'setLevel'}
    <label>
      <span class="hint">to</span>
      <select value={targetLevel} onchange={(e) => { targetLevel = Number(e.currentTarget.value); void replan(); }}>
        {#each levels as level (level)}<option value={level}>{level}</option>{/each}
      </select>
    </label>
    <span class="hint">Writes every vector of each word.</span>
  {/if}

  {#if needsTargetDeck}
    <label>
      <span class="hint">Target deck</span>
      <!-- No default: which deck is being written to is never guessed. Only this
           language's decks are offered, so a selection can never span two. -->
      <select value={targetDeckId} onchange={(e) => { targetDeckId = e.currentTarget.value; void replan(); }}>
        <option value="">Choose a deck…</option>
        {#each decks as deck (deck.id)}<option value={deck.id}>{deck.name}</option>{/each}
      </select>
    </label>
  {/if}
</div>

<h2>3 · What will change</h2>
{#if !plan}
  <p class="hint">Working…</p>
{:else if plan.wordsAffected === 0}
  <p class="hint">Nothing matches this selection, so there is nothing to change.</p>
{:else}
  <div class="summary">
    <p>
      <strong>{plan.wordsAffected}</strong>
      {plan.wordsAffected === 1 ? 'word' : 'words'}
      {#if needsTargetDeck && targetDeck}
        · {operation === 'addDeck' ? 'into' : 'out of'} <strong>{targetDeck.name}</strong>
      {/if}
    </p>

    {#if plan.downwardWords > 0 && operation === 'setLevel'}
      <p class="down">
        <strong>{plan.downwardWords}</strong>
        {plan.downwardWords === 1 ? 'word loses' : 'words lose'} mastery — already above
        {targetLevel} on at least one vector, and every vector is written.
      </p>
    {/if}

    {#if plan.introduced.length > 0}
      <p class="hint">
        {plan.introduced.length} never-studied {plan.introduced.length === 1 ? 'word' : 'words'} will
        be treated as known and scheduled for review, spread over about
        {Math.ceil(plan.introduced.length / staggerRate(cardCap))} days.
      </p>
    {/if}

    {#if plan.sample.length > 0}
      <div class="hint">A sample, spread across the selection:</div>
      <ul class="sample">
        {#each plan.sample as row, i (i)}
          <li>
            <span class="term">{row.term}</span>
            <span class="pos">{row.partOfSpeech}</span>
            {#if row.vectorId}
              <span class="move" class:down={row.to < row.from}>{row.from} → {row.to}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<h2>4 · Comment</h2>
<p class="hint">Required. It is what identifies the snapshot months from now.</p>
<input
  type="text"
  bind:value={comment}
  placeholder="e.g. reset mastered finance words for review"
/>

<div class="commit">
  <button class="primary" disabled={!ready} onclick={() => void commit()}>
    {working ? 'Applying…' : 'Apply'}
  </button>
  {#if needsTargetDeck && targetDeckId === ''}
    <span class="hint">Choose a target deck first.</span>
  {/if}
</div>

{#if failure}<p class="failed">Nothing was changed: {failure}</p>{/if}
{#if done}<p class="done">{done}</p>{/if}

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

  h2 {
    font-size: var(--size-body);
    margin: 18px 0 6px;
  }

  .warn {
    border: 1px solid var(--incorrect);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: var(--size-small);
  }

  .ops {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px;
  }

  .ops label {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .summary {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
  }

  .down {
    color: var(--incorrect);
  }

  .sample {
    list-style: none;
    margin-top: 6px;
    max-height: 220px;
    overflow-y: auto;
  }

  .sample li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 2px 0;
    font-size: var(--size-small);
  }

  .pos {
    color: var(--text-muted);
    font-size: var(--size-tiny);
  }

  .move {
    margin-left: auto;
    color: var(--text-secondary);
  }

  .move.down {
    color: var(--incorrect);
  }

  .commit {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
  }

  .failed {
    color: var(--incorrect);
  }

  .done {
    color: var(--correct);
  }
</style>
