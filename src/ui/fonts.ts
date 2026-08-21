/**
 * Self-hosted font registration.
 *
 * The `@font-face` rules are injected rather than written in a stylesheet for
 * one reason: the app is served from a sub-path, and Vite does NOT rewrite
 * absolute `url()` values in CSS with the base. A stylesheet saying
 * `/fonts/inter-400.woff2` silently resolves to the wrong place once deployed,
 * and the only symptom is fonts quietly not loading. `import.meta.env.BASE_URL`
 * is correct in dev, in preview, and at any base.
 *
 * FILES ARE OPTIONAL. Until they are added the browser simply falls back to the
 * system stack — the app works, it just loses the guaranteed Vietnamese
 * coverage that made the font list curated in the first place.
 *
 * To add them:
 *   1. https://gwfh.mranftl.com/fonts — pick the family
 *   2. Tick charsets: latin, latin-ext, AND vietnamese
 *   3. Take the .woff2 files only
 *   4. Rename as below and drop into  public/fonts/
 *
 * All five are SIL Open Font License: free to self-host and redistribute, with
 * no attribution required in the interface.
 */

/** Family name as used in settings, and the file slug it expects. */
const FAMILIES: readonly { family: string; slug: string }[] = Object.freeze([
  { family: 'Noto Sans', slug: 'noto-sans' },
  { family: 'Inter', slug: 'inter' },
  { family: 'Roboto', slug: 'roboto' },
  { family: 'Open Sans', slug: 'open-sans' },
  { family: 'Source Sans 3', slug: 'source-sans-3' },
]);

/** Only these are ever asked for — base.css uses no other weight. */
const WEIGHTS: readonly number[] = Object.freeze([400, 500]);

export function fontFaceCss(base: string = import.meta.env.BASE_URL): string {
  return FAMILIES.flatMap(({ family, slug }) =>
    WEIGHTS.map(
      (weight) => `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('${base}fonts/${slug}-${weight}.woff2') format('woff2')}`,
    ),
  ).join('\n');
}

/** Call once at startup, before the first paint that matters. */
export function installFontFaces(): void {
  const style = document.createElement('style');
  style.dataset.fonts = 'self-hosted';
  style.textContent = fontFaceCss();
  document.head.appendChild(style);
}
