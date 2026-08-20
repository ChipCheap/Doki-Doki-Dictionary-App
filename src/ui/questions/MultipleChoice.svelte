<script lang="ts">
  /** Recognition: show the target word, pick its meaning from four options. */
  import type { DistractorCandidate } from '../../domain/distractors';

  interface Props {
    term: string;
    partOfSpeech: string;
    options: readonly DistractorCandidate[];
    disabled: boolean;
    onselect: (displayed: string) => void;
  }

  let { term, partOfSpeech, options, disabled, onselect }: Props = $props();
</script>

<div class="prompt">
  <div class="term">{term}</div>
  <div class="pos">{partOfSpeech}</div>
</div>

<div class="stack" style="gap: 8px">
  {#each options as option, i (option.key)}
    <button class="option" {disabled} onclick={() => onselect(option.displayed)}>
      <span class="num">{i + 1}</span>
      {option.displayed}
    </button>
  {/each}
</div>

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

  .option {
    text-align: left;
    width: 100%;
  }

  .num {
    color: var(--text-muted);
    margin-right: 8px;
  }
</style>
