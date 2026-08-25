/**
 * H1 — the pack generator's command line.
 *
 * `fetch` downloads and pins sources; `build` turns them into a pack. Nothing
 * here runs in the app or ships to a user — this is a developer tool that reads
 * ~1 GB of cached input and writes files.
 */

import { build, prune, TARGET_ENTRIES } from './build';
import { fetchSources, LANGUAGES } from './sources';

const USAGE = `
Pack generator.

  npm run packs:fetch <language> [--refresh]   download and pin sources
  npm run packs:build <language> [options]     build a pack from the cache
  npm run packs:prune -- --confirm             drop registry keys no pack uses

Languages: ${Object.keys(LANGUAGES).join(', ')}

Build options:
  --dry-run        report what would be produced, write nothing
  --allow-churn    proceed despite orphaned or merged keys. Read the churn
                   report first: this is how a user's progress gets stranded.
  --entries=<n>    override the entry target (default es ${TARGET_ENTRIES.es}, vi ${TARGET_ENTRIES.vi})
`;

async function main(): Promise<void> {
  const [command, language, ...flags] = process.argv.slice(2);
  const root = process.cwd();

  if (command === 'prune') {
    const all = process.argv.slice(3);
    if (!all.includes('--confirm')) {
      console.log(
        [
          'prune drops every registry key no built pack uses.',
          '',
          'This is safe ONLY before release. It discards the record of keys',
          'that were minted and later dropped, so an ordinal retired earlier',
          'can be issued again to a different sense. Once anyone holds',
          'progress against a key, that is silent corruption.',
          '',
          'Build every language first, then re-run with --confirm.',
        ].join('\n'),
      );
      process.exitCode = 1;
      return;
    }

    const report = await prune(root);
    console.log(
      `registry ${report.before} -> ${report.after} records (${report.removed} dropped)`,
    );
    return;
  }

  if (!command || !language) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  if (command === 'fetch') {
    const report = await fetchSources(root, language, flags.includes('--refresh'));
    for (const source of report) {
      const mb = (source.bytes / 1_048_576).toFixed(1);
      console.log(`${source.id.padEnd(20)} ${mb.padStart(8)} MB  ${source.cached ? 'cached' : 'downloaded'}`);
    }
    return;
  }

  if (command === 'build') {
    const entriesFlag = flags.find((f) => f.startsWith('--entries='));
    const result = await build({
      root,
      language,
      allowChurn: flags.includes('--allow-churn'),
      dryRun: flags.includes('--dry-run'),
      ...(entriesFlag ? { targetEntries: Number(entriesFlag.split('=')[1]) } : {}),
    });

    console.log(result.summary);
    // A build that refused to write is a failure, not a report: exiting 0 would
    // let a script carry on as though a pack had been produced.
    if (!result.wrote && !flags.includes('--dry-run')) process.exitCode = 1;
    return;
  }

  console.log(USAGE);
  process.exitCode = 1;
}

await main();
