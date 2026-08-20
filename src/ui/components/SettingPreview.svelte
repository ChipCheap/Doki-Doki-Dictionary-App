<script lang="ts">
  /**
   * A live preview beside its control, so the effect is judged without visiting
   * a quiz. The sample text is deliberately the stacked-mark cases — a preview
   * should show where a font FAILS, not a flattering word.
   */
  interface Props {
    sample?: string;
    caption: string;
    font?: string;
    scale?: number;
  }

  let { sample = 'ế ộ ữ ẳ', caption, font, scale }: Props = $props();
</script>

<div
  class="preview"
  style="{font ? `font-family: '${font}', system-ui, sans-serif;` : ''}{scale
    ? `font-size: calc(19px * ${scale});`
    : ''}"
>
  <div class="sample">{sample}</div>
  <div class="hint">{caption}</div>
</div>

<style>
  .preview {
    background: var(--sunken);
    border-radius: var(--radius);
    padding: 10px 12px;
    text-align: center;
  }

  .sample {
    font-size: calc(19px * var(--app-text-scale));
    line-height: 1.6;
  }
</style>
