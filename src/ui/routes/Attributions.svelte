<script lang="ts">
  /**
   * S5 — attributions.
   *
   * `ui.framework.md` puts it plainly: "Source licences. A licensing
   * obligation, not a courtesy." The packs are derived from share-alike data,
   * so this screen is what makes distributing them lawful, not a credits roll.
   *
   * Everything shown was recorded at install, so it is complete offline — which
   * matters, because a PWA still owes attribution with the network down.
   */
  import { onMount } from 'svelte';
  import {
    listAttributions,
    PACK_LICENCE,
    type PackAttribution,
  } from '../../dictionary/queries';
  import { router } from '../router.svelte';

  /** The application's own licence. Distinct from the data's — see below. */
  const APP_LICENCE = 'GPL-3.0-or-later';
  const APP_LICENCE_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';

  let packs = $state<PackAttribution[]>([]);
  let loaded = $state(false);

  onMount(() => {
    void (async () => {
      packs = await listAttributions();
      loaded = true;
    })();
  });
</script>

<div class="head">
  <button class="quiet" onclick={() => router.go('home')}>← Decks</button>
  <h1>Attributions</h1>
</div>

<p class="lede">
  The word packs in this app are built from openly licensed data. They are
  <strong>derived works</strong> distributed under <strong>{PACK_LICENCE}</strong>,
  which means you may share and adapt them — including for commercial purposes —
  provided you credit the sources below and pass on the same freedom under the
  same licence.
</p>

{#if loaded}
  {#each packs as pack (pack.language)}
    <section>
      <div class="lang">
        <h2>{pack.languageName}</h2>
        <span class="hint">
          {pack.entryCount} entries · pack {pack.packVersion} · {PACK_LICENCE}
        </span>
      </div>

      <div class="card">
        {#each pack.sources as source, i (source.name + source.licence)}
          {#if i > 0}<div class="sep"></div>{/if}
          <div class="source">
            <div class="name">{source.name}</div>
            <div class="hint">{source.licence}</div>
            <!-- Written out rather than hidden behind link text: with no
                 network a URL the reader can copy still discharges the
                 obligation, where "click here" does not. -->
            {#if source.url}<div class="url">{source.url}</div>{/if}
          </div>
        {:else}
          <p class="hint">This pack recorded no sources.</p>
        {/each}
      </div>
    </section>
  {:else}
    <p class="hint">
      No language pack is installed yet. Each pack lists its own sources here
      once you add one.
    </p>
  {/each}
{/if}

<hr />

<section>
  <h2>This application</h2>
  <div class="card">
    <div class="source">
      <div class="name">Doki-Doki Dictionary</div>
      <div class="hint">{APP_LICENCE}</div>
      <div class="url">{APP_LICENCE_URL}</div>
    </div>
  </div>
  <p class="hint note">
    The program and the packs are licensed separately. A pack shipped alongside
    an application is a collection, not an adaptation, so the packs' share-alike
    terms cover the data and not the code.
  </p>
</section>

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
  }

  .lede {
    font-size: var(--size-small);
    margin-bottom: 18px;
  }

  .lang {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 8px;
  }

  section {
    margin-bottom: 18px;
  }

  .source {
    padding: 8px 0;
  }

  .name {
    font-size: var(--size-body);
  }

  .url {
    font-size: var(--size-tiny);
    color: var(--text-muted);
    word-break: break-all;
    margin-top: 2px;
  }

  .sep {
    border-top: 1px solid var(--border);
  }

  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 18px 0 16px;
  }

  .note {
    margin-top: 8px;
  }
</style>
