<script lang="ts">
  /**
   * S23 — the new vocabulary screen.
   *
   * New words are shown before they are quizzed, never sprung as a question the
   * user cannot possibly answer. It is a PREVIEW: abandoning it writes nothing,
   * so the words stay un-introduced and the next session may pick a different
   * set. `introducedOn` is stamped when a word is first QUIZZED, not here.
   */
  import { sessionSettingsFor } from '../../progress/deck-repo';
  import { markIntroduced, setHidden, setLevelForAllVectors } from '../../progress/progress-repo';
  import { router } from '../router.svelte';
  import { session, termWithArticle } from '../session/session-store.svelte';

  let index = $state(0);

  const cards = $derived(session.newCards);
  const card = $derived(cards[index]);
  const entry = $derived(card ? session.entryFor(card.wordKey) : undefined);

  /** ui.framework.md maps the already-known row onto the ladder. */
  const KNOWN_LEVELS = [
    { label: 'a bit', level: 2 },
    { label: 'well', level: 5 },
    { label: 'very well', level: 8 },
  ];

  async function alreadyKnown(level: number): Promise<void> {
    if (!card || !session.deck) return;
    const settings = sessionSettingsFor(session.deck);
    await setLevelForAllVectors(card.wordKey, level, settings.enabledVectors, session.today);
    await markIntroduced(card.wordKey, session.today);
    dropCurrent();
  }

  async function dontStudy(): Promise<void> {
    if (!card) return;
    await setHidden(card.wordKey, true);
    await markIntroduced(card.wordKey, session.today);
    dropCurrent();
  }

  /**
   * The daily budget was for learning n words, so dismissing one already known
   * should not spend a slot — the session drops it and carries on with the rest.
   */
  function dropCurrent(): void {
    if (!card) return;
    session.drawn = session.drawn.filter((c) => c !== card);
    if (index >= session.newCards.length) index = Math.max(0, session.newCards.length - 1);
  }

  function start(): void {
    router.replace('quiz');
  }
</script>

<div class="head">
  <button class="quiet" disabled={index === 0} onclick={() => (index -= 1)}>←</button>
  <span class="hint">{cards.length === 0 ? 'none' : `${index + 1} of ${cards.length}`}</span>
  <button class="quiet" disabled={index >= cards.length - 1} onclick={() => (index += 1)}>→</button>
</div>

{#if !entry}
  <div class="card"><p class="hint">No new words in this session.</p></div>
{:else}
  <div class="card">
    <div class="term">{termWithArticle(entry)}</div>
    <div class="meta">({entry.partOfSpeech}) {entry.meanings.join(', ')}</div>
    <div class="hint tags">{entry.difficulty}{#each entry.contextTags as t (t)} · {t}{/each}</div>

    {#if entry.examples.length > 0}
      <details class="sentences">
        <summary>Sentences</summary>
        {#each entry.examples as example (example.id)}
          <div class="example">
            {example.text}
            {#if example.translation}<div class="hint">{example.translation}</div>{/if}
          </div>
        {/each}
      </details>
    {/if}

    <!-- No audio control: v1 ships the seam, not the feature. -->

    <div class="known">
      <div class="hint">Know this already?</div>
      <div class="choices">
        {#each KNOWN_LEVELS as choice (choice.level)}
          <button onclick={() => void alreadyKnown(choice.level)}>{choice.label}</button>
        {/each}
        <button onclick={() => void dontStudy()}>Don't study</button>
      </div>
      <div class="hint">Any of these swaps in another new word.</div>
    </div>
  </div>
{/if}

<div class="foot">
  <button class="primary" onclick={start}>Start quiz</button>
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 440px;
    margin: 0 auto 12px;
  }

  .card {
    max-width: 440px;
    margin: 0 auto;
    text-align: center;
  }

  .term {
    font-size: calc(28px * var(--app-text-scale));
    font-weight: 500;
  }

  .meta {
    color: var(--text-secondary);
    font-size: var(--size-small);
    margin-top: 6px;
  }

  .tags {
    margin-top: 4px;
  }

  .sentences {
    margin-top: 14px;
    text-align: left;
  }

  .example {
    color: var(--text-secondary);
    font-size: var(--size-small);
    margin-top: 8px;
  }

  .known {
    border-top: 1px solid var(--border);
    margin-top: 16px;
    padding-top: 12px;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    margin: 8px 0;
  }

  .foot {
    max-width: 440px;
    margin: 14px auto 0;
    display: flex;
    justify-content: flex-end;
  }
</style>
