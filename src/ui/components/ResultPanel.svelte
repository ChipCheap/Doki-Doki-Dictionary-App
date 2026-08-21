<script lang="ts">
  /**
   * S24 — the result panel.
   *
   * On desktop this holds the PREVIOUS word: a correct answer advances at once,
   * so the entry just earned stays readable while the next question is answered.
   * The pane runs one card behind, deliberately.
   */
  import type { DictionaryEntry } from '../../dictionary/pack-format';
  import { MASTERED_LEVEL } from '../../domain/ladder';
  import { termWithArticle, type ResolvedResult } from '../session/session-store.svelte';
  import DiacriticDiff from './DiacriticDiff.svelte';

  interface Props {
    entry?: DictionaryEntry;
    /**
     * Recorded at resolution time. NOT inferred from the live phase: a correct
     * answer auto-advances on desktop, so the phase has already returned to
     * `typing` by the time this renders.
     */
    result?: ResolvedResult;
    showChoices: boolean;
    inRequeuePass: boolean;
    onmarkcorrect: () => void;
    onredo: () => void;
    oncontinue: () => void;
    onsetlevel: (level: number) => void;
  }

  let {
    entry,
    result,
    showChoices,
    inRequeuePass,
    onmarkcorrect,
    onredo,
    oncontinue,
    onsetlevel,
  }: Props = $props();

  const correct = $derived(result?.correct ?? false);
  const movement = $derived(result?.movement);

  const levels = Array.from({ length: MASTERED_LEVEL + 1 }, (_, i) => i);
</script>

<div class="panel">
  {#if !entry}
    <!-- First card of a session. Empty, not blank-with-error. -->
    <p class="hint">Answer a card and it will appear here.</p>
  {:else}
    <div class="outcome" class:good={correct}>
      {correct ? 'correct' : 'not quite'}
      {#if movement}
        <span class="hint">
          · level {movement.from} → {movement.to}
        </span>
      {/if}
    </div>

    {#if !correct && result?.typed && result.expected}
      <DiacriticDiff typed={result.typed} expected={result.expected} />
    {/if}

    <div class="entry">
      <div class="term">{termWithArticle(entry)}</div>
      <div class="meta">
        {entry.partOfSpeech} · {entry.difficulty}{#each entry.contextTags as tag (tag)} · {tag}{/each}
      </div>
      <div class="meanings">{entry.meanings.join(', ')}</div>

      {#each entry.examples as example (example.id)}
        <div class="example">
          {example.text}
          {#if example.translation}<div class="hint">{example.translation}</div>{/if}
        </div>
      {/each}
    </div>

    {#if showChoices}
      <div class="choices">
        <!-- The default path, and deliberately the plain one: continuing is
             what demotes, and the other two take a conscious press. It needs a
             button as well as a key, or a pointer user has no way forward. -->
        <button class="primary" onclick={oncontinue}>Continue <span class="key">⏎</span></button>
        <button onclick={onmarkcorrect}>Mark correct <span class="key">m</span></button>
        {#if !inRequeuePass}
          <button onclick={onredo}>Redo question <span class="key">r</span></button>
        {/if}
      </div>
    {/if}

    <label class="mastery">
      <span class="hint">Set mastery — applies to every vector of this word</span>
      <select
        value={movement?.to ?? 0}
        onchange={(e) => onsetlevel(Number(e.currentTarget.value))}
      >
        {#each levels as level (level)}<option value={level}>{level}</option>{/each}
      </select>
    </label>
  {/if}
</div>

<style>
  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px;
    min-height: 200px;
  }

  .outcome {
    font-size: var(--size-small);
    color: var(--incorrect);
    margin-bottom: 10px;
  }

  .outcome.good {
    color: var(--correct);
  }

  .entry {
    margin-top: 12px;
  }

  .term {
    font-size: calc(19px * var(--app-text-scale));
    font-weight: 500;
  }

  .meta {
    color: var(--text-secondary);
    font-size: var(--size-tiny);
    margin: 2px 0 8px;
  }

  .example {
    color: var(--text-secondary);
    font-size: var(--size-small);
    margin-top: 10px;
  }

  .choices {
    display: flex;
    gap: 8px;
    margin-top: 14px;
  }

  .key {
    color: var(--text-muted);
  }

  .mastery {
    display: block;
    margin-top: 14px;
  }

  .mastery select {
    width: auto;
    margin-top: 4px;
  }
</style>
