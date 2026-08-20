<script lang="ts">
  import { onMount } from 'svelte';
  import { listInstalledPacks } from '../dictionary/install';
  import { startup } from './app-init';
  import { router } from './router.svelte';
  import FirstRun from './routes/FirstRun.svelte';
  import Home from './routes/Home.svelte';
  import InstallPack from './routes/InstallPack.svelte';
  import KeyboardHelp from './routes/KeyboardHelp.svelte';
  import NewVocabulary from './routes/NewVocabulary.svelte';
  import Quiz from './routes/Quiz.svelte';
  import SessionSummary from './routes/SessionSummary.svelte';
  import Settings from './routes/Settings.svelte';
  import Transfer from './routes/Transfer.svelte';

  let ready = $state(false);
  let hasPack = $state(false);

  onMount(() => {
    const stop = router.start();

    void (async () => {
      await startup();
      hasPack = (await listInstalledPacks()).length > 0;
      // Nothing installed means there is nothing to study and no deck to make,
      // so the first-run flow is the only sensible destination.
      if (!hasPack && router.current.name !== 'installPack') {
        router.replace('firstRun');
      }
      ready = true;
    })();

    return stop;
  });

  const route = $derived(router.current);
</script>

{#if !ready}
  <!-- Deliberately empty. Startup reads a few small rows; a spinner here would
       flash for a frame and teach the user that the app is slow. -->
  <div aria-hidden="true"></div>
{:else if route.name === 'firstRun'}
  <FirstRun />
{:else if route.name === 'installPack'}
  <InstallPack language={route.params.language ?? ''} />
{:else if route.name === 'quiz'}
  <Quiz />
{:else if route.name === 'newVocabulary'}
  <NewVocabulary />
{:else if route.name === 'summary'}
  <SessionSummary />
{:else if route.name === 'settings'}
  <Settings deckId={route.params.deck ?? ''} />
{:else if route.name === 'transfer'}
  <Transfer />
{:else if route.name === 'keyboardHelp'}
  <KeyboardHelp />
{:else}
  <Home />
{/if}
