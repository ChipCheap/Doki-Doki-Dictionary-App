<script lang="ts">
  /**
   * S19 — the quiz shell.
   *
   * Two-pane on desktop, stacked on mobile. What genuinely diverges is
   * auto-advance: on desktop a correct answer advances instantly and the entry
   * lands in the right pane, still readable while the next question is
   * answered. Stacked on mobile that pane is below the fold, so an instant
   * advance would show the user nothing — mobile dwells where desktop does not.
   */
  import { onMount } from 'svelte';
  import { QuestionMethod } from '../../domain/vectors';
  import { setLevelForAllVectors } from '../../progress/progress-repo';
  import { sessionSettingsFor } from '../../progress/deck-repo';
  import ResultPanel from '../components/ResultPanel.svelte';
  import { questionTypeFor } from '../questions/registry';
  import { resolveKey, fieldShouldBeFocused } from '../session/keyboard';
  import { session } from '../session/session-store.svelte';
  import MultipleChoice from '../questions/MultipleChoice.svelte';
  import TypedAnswer from '../questions/TypedAnswer.svelte';
  import SessionSummary from './SessionSummary.svelte';

  let typed = $state('');
  let wide = $state(true);

  const card = $derived(session.current);
  const type = $derived(card ? questionTypeFor(card.method) : undefined);
  const answering = $derived(
    session.phase === 'typing' || session.phase === 'rejected' || session.phase === 'primed',
  );

  onMount(() => {
    const query = window.matchMedia('(min-width: 780px)');
    const sync = () => (wide = query.matches);
    sync();
    query.addEventListener('change', sync);

    const onKey = (event: KeyboardEvent) => void handleKey(event);
    window.addEventListener('keydown', onKey);

    return () => {
      query.removeEventListener('change', sync);
      window.removeEventListener('keydown', onKey);
    };
  });

  // Deliberately NOT navigating away when the session ends. Jumping straight to
  // a summary swallowed the last card's result — the one answer you cannot
  // review afterwards. The summary renders below the panes instead.

  // Clear the field whenever a different card arrives. Without this the
  // previous answer sits in the box under the new prompt.
  let shownKey = $state('');
  $effect(() => {
    const key = card ? `${card.card.wordKey}|${card.card.vectorId}` : '';
    if (key !== shownKey) {
      shownKey = key;
      typed = '';
    }
  });

  async function handleKey(event: KeyboardEvent): Promise<void> {
    if (!card) return;

    const action = resolveKey(event, {
      phase: session.phase,
      hasInput: typed.trim().length > 0,
      numericSelect: type?.numericSelect ?? false,
    });

    if (action === 'ignore') {
      if (event.key === 'Tab' && fieldShouldBeFocused(session.phase)) event.preventDefault();
      return;
    }

    event.preventDefault();

    if (action === 'submit') {
      await session.submit(typed);
      if (session.phase === 'resultCorrect' && wide) await advance();
      return;
    }
    if (action === 'prime') return session.prime();
    if (action === 'dontKnow') return session.dontKnow();
    if (action === 'continue') return advance();
    if (action === 'markCorrect') return void session.chooseMarkCorrect().then(clear);
    if (action === 'redo') return void session.chooseRedo().then(clear);

    if (typeof action === 'object' && card.options) {
      const option = card.options[action.select];
      if (option) await choose(option.displayed);
    }
  }

  function clear(): void {
    typed = '';
  }

  async function advance(): Promise<void> {
    // Enter on a wrong answer accepts the demotion — the default is the
    // punishing path, and choosing otherwise takes a deliberate press.
    if (session.phase === 'resultWrong') await session.chooseAccept();
    else await session.advance();
    clear();
  }

  async function choose(displayed: string): Promise<void> {
    await session.submit(displayed);
    if (session.phase === 'resultCorrect' && wide) await advance();
  }

  async function setLevel(level: number): Promise<void> {
    const resolved = session.lastResolved;
    if (!resolved || !session.deck) return;
    const settings = sessionSettingsFor(session.deck);
    await setLevelForAllVectors(
      resolved.card.wordKey,
      level,
      settings.enabledVectors,
      session.today,
    );
  }
</script>

<div class="head">
  <span class="hint">
    {#if session.inRequeuePass}
      {session.requeue.length} to get right
    {:else}
      {session.graded} of {session.total}
    {/if}
  </span>
  <button class="quiet" onclick={() => session.dontKnow()} disabled={!answering}>
    I don't know
  </button>
</div>

<div class="panes" class:wide>
  <div class="card">
    {#if session.loading}
      <p class="hint">Building the session…</p>
    {:else if !card}
      <p class="done">All done.</p>
    {:else if card.method === QuestionMethod.FOREIGN_TO_BASE_MC}
      <MultipleChoice
        term={card.entry.term}
        partOfSpeech={card.entry.partOfSpeech}
        options={card.options ?? []}
        disabled={!answering}
        onselect={choose}
      />
    {:else}
      <TypedAnswer
        meaning={card.promptedMeaning ?? ''}
        partOfSpeech={card.entry.partOfSpeech}
        value={typed}
        disabled={!answering}
        rejected={session.phase === 'rejected'}
        oninput={(v) => (typed = v)}
      />
    {/if}

    {#if session.phase === 'primed'}
      <p class="primed">Submit nothing? Press Enter again to mark it unknown.</p>
    {/if}
  </div>

  <ResultPanel
    entry={session.lastResolved?.entry}
    result={session.lastResult}
    showChoices={session.phase === 'resultWrong'}
    inRequeuePass={session.inRequeuePass}
    onmarkcorrect={() => void session.chooseMarkCorrect().then(clear)}
    onredo={() => void session.chooseRedo().then(clear)}
    oncontinue={() => void advance()}
    onsetlevel={(l) => void setLevel(l)}
  />
</div>

{#if session.finished}
  <!-- Below both panes, so the last answer is still on screen beside it. -->
  <div class="summary">
    <SessionSummary />
  </div>
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .panes {
    display: grid;
    gap: 12px;
    /* Stacked by default; the same content in the same order, so the desktop
       layout is one axis change rather than a second design. */
    grid-template-columns: 1fr;
  }

  .panes.wide {
    grid-template-columns: 1fr 1fr;
  }

  .primed {
    color: var(--text-secondary);
    font-size: var(--size-small);
    text-align: center;
  }

  .done {
    text-align: center;
    color: var(--text-secondary);
    margin: 40px 0;
  }

  .summary {
    margin-top: 16px;
  }
</style>
