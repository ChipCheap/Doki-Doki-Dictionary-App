<script lang="ts">
  /**
   * Production: show a meaning, type the target word — orthographically exact.
   *
   * The field is focused the moment the card appears: never a click, never a
   * tab (ui.framework.md invariant 1).
   */
  import { router } from '../router.svelte';

  interface Props {
    meaning: string;
    partOfSpeech: string;
    value: string;
    disabled: boolean;
    /** Set when a real word was typed that is not the one being asked for. */
    rejected: boolean;
    oninput: (value: string) => void;
  }

  let { meaning, partOfSpeech, value, disabled, rejected, oninput }: Props = $props();

  let field = $state<HTMLInputElement | undefined>();

  $effect(() => {
    if (!disabled && field) field.focus();
  });

  export function focus(): void {
    field?.focus();
  }
</script>

<div class="prompt">
  <div class="term">{meaning}</div>
  <div class="pos">{partOfSpeech}</div>
</div>

<input
  bind:this={field}
  type="text"
  autocomplete="off"
  autocapitalize="off"
  autocorrect="off"
  spellcheck="false"
  {disabled}
  {value}
  oninput={(e) => oninput(e.currentTarget.value)}
/>

{#if rejected}
  <!-- A refused submission, not a grade: the field stays live and nothing
       advances. No letter hints — coming up with a different word for the same
       meaning is the skill being exercised. -->
  <p class="rejected">That's a real word for this meaning, but not the one being asked for.</p>
{/if}

<!-- On demand, not ambient. Someone who cannot type a tone mark will be staring
     at this field, so the way out sits here rather than in a menu. -->
<button
  class="quiet help"
  title="Typing accents and tone marks"
  onclick={() => router.go('keyboardHelp')}
>
  Need a keyboard for accents?
</button>

<style>
  .prompt {
    text-align: center;
    margin: 18px 0 20px;
  }

  .term {
    font-size: var(--size-prompt);
    font-weight: 500;
  }

  .pos {
    color: var(--text-secondary);
    font-size: var(--size-tiny);
    margin-top: 4px;
  }

  .rejected {
    color: var(--text-secondary);
    font-size: var(--size-small);
    margin: 8px 0 0;
  }

  .help {
    margin-top: 10px;
    font-size: var(--size-tiny);
    color: var(--text-muted);
  }
</style>
