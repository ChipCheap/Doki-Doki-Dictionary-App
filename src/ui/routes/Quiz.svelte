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
  import { router } from '../router.svelte';
  import { session, termWithArticle } from '../session/session-store.svelte';
  import MultipleChoice from '../questions/MultipleChoice.svelte';
  import TypedAnswer from '../questions/TypedAnswer.svelte';
  import SessionSummary from './SessionSummary.svelte';

  let typed = $state('');
  let wide = $state(true);
  /** The end-quiz confirmation is open. */
  let ending = $state(false);
  let cancelEnding = $state<HTMLButtonElement | undefined>();

  // Cancel takes the focus, so the Enter the user may already be pressing —
  // Enter is the answer key — lands on the harmless button, not on Confirm.
  $effect(() => {
    if (ending) cancelEnding?.focus();
  });

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
    // While the confirmation is open the quiz keys are inert: Enter must not
    // answer a card the user cannot see behind the dialog.
    if (ending) {
      if (event.key === 'Escape') {
        event.preventDefault();
        ending = false;
      }
      return;
    }

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

  /** Acts on the word in the result pane — the previous card on desktop. */
  async function toggleHidden(): Promise<void> {
    const key = session.lastResolved?.card.wordKey;
    if (!key) return;
    await session.setWordHidden(key, !session.hiddenWords.has(key));
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

<!-- Once the queue is empty all three are stale: the counter counts nothing,
     "I don't know" answers nothing, and there is no longer a quiz to end — the
     summary below carries its own way back. They are hidden rather than
     removed, so the summary does not jump up the page as the last card
     resolves — `visibility` keeps the box, `display` would not. -->
<div class="head" class:spent={!card && !session.loading}>
  <span class="hint">
    {#if session.inRequeuePass}
      {session.requeue.length} to get right
    {:else}
      {session.graded} of {session.total}
    {/if}
  </span>
  <!-- Leaving costs nothing — every grade is written the moment it is made —
       but it still confirms: the button sits among the controls a user reaches
       for mid-answer, and a mis-click would throw away the queue that was
       drawn, including the words already re-queued for a second look. -->
  <button class="quiet" onclick={() => (ending = true)}>End quiz</button>
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
        term={termWithArticle(card.entry)}
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
    showChoices={session.phase === 'resultWrong' ||
      (session.phase === 'resultCorrect' && !wide)}
    inRequeuePass={session.inRequeuePass}
    onmarkcorrect={() => void session.chooseMarkCorrect().then(clear)}
    onredo={() => void session.chooseRedo().then(clear)}
    oncontinue={() => void advance()}
    onsetlevel={(l) => void setLevel(l)}
    hidden={session.lastResolved ? session.hiddenWords.has(session.lastResolved.card.wordKey) : false}
    ontogglehidden={() => void toggleHidden()}
  />
</div>

{#if session.finished}
  <!-- Below both panes, so the last answer is still on screen beside it. -->
  <div class="summary">
    <SessionSummary />
  </div>
{/if}

{#if ending}
  <!-- The scrim is deliberately inert: a stray click on the page behind should
       not end a session, and Cancel and Escape are both one action away. -->
  <div class="scrim"></div>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="end-quiz">
    <p id="end-quiz">Do you really want to end the quiz? All results so far were already saved.</p>
    <div class="buttons">
      <button class="primary" onclick={() => router.go('home')}>Confirm</button>
      <button class="quiet" bind:this={cancelEnding} onclick={() => (ending = false)}>Cancel</button>
    </div>
  </div>
{/if}

<style>
  /* Three columns rather than `space-between`: the outer two share the leftover
     width evenly, so End quiz sits on the centre of the page and does not drift
     as the counter's text changes width. */
  .head {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .head > :last-child {
    justify-self: end;
  }

  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.5);
    z-index: 20;
  }

  .dialog {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100vw - 32px));
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    padding: 16px 18px;
    box-shadow: 0 8px 28px rgb(0 0 0 / 0.3);
    z-index: 21;
  }

  .dialog .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .panes {
    display: grid;
    gap: 12px;
    /* Stacked by default; the same content in the same order, so the desktop
       layout is one axis change rather than a second design. */
    grid-template-columns: 1fr;
  }

  .head.spent {
    visibility: hidden;
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
