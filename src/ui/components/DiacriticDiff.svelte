<script lang="ts">
  /**
   * S25 — the diacritic mismatch display.
   *
   * Per-character highlighting applies ONLY when diacritics are the sole
   * difference. A substantively wrong answer shows both forms plainly, because
   * highlighting every mismatched glyph there would be noise dressed as
   * feedback.
   *
   * The highlight uses a background block and weight as well as colour: it
   * carries the entire explanation of why the answer was wrong, and colour
   * alone fails for a colour-blind reader.
   */
  import { diacriticDiff } from '../../domain/matching';

  interface Props {
    typed: string;
    expected: string;
  }

  let { typed, expected }: Props = $props();

  const diff = $derived(diacriticDiff(typed, expected));
  const typedChars = $derived(Array.from(typed));
  const expectedChars = $derived(Array.from(expected));
  const marked = $derived(new Set(diff.positions));
</script>

<div class="stack" style="gap: 6px">
  <div>
    <div class="hint">you typed</div>
    <div class="word">
      {#if diff.diacriticsOnly}
        {#each typedChars as char, i (i)}<span class:miss={marked.has(i)}>{char}</span>{/each}
      {:else}
        {typed}
      {/if}
    </div>
  </div>

  <div>
    <div class="hint">answer</div>
    <div class="word">
      {#if diff.diacriticsOnly}
        {#each expectedChars as char, i (i)}<span class:hit={marked.has(i)}>{char}</span>{/each}
      {:else}
        {expected}
      {/if}
    </div>
  </div>
</div>

<style>
  .word {
    font-size: calc(21px * var(--app-text-scale));
    line-height: 1.5;
  }

  .miss,
  .hit {
    /* Weight and a background block, not colour alone. */
    font-weight: 500;
    padding: 0 2px;
    border-radius: 3px;
  }

  .miss {
    background: var(--miss-bg);
    color: var(--miss-text);
  }

  .hit {
    background: var(--hit-bg);
    color: var(--hit-text);
  }
</style>
