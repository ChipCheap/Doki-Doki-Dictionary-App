/**
 * The build: source files in, a core pack and a meaning layer out.
 *
 * Order matters and is the plan's: read, fold frequency, cap senses, select by
 * rank, resolve keys, assemble examples, verify, then write. Nothing is written
 * until the registry has agreed every key and the app's own validators have
 * accepted every entry.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  CorePackEntry,
  MeaningPackEntry,
} from '../../src/dictionary/pack-format';
import { SUPPORTED_SCHEMA_VERSION } from '../../src/dictionary/pack-format';
import { readKaikki } from './kaikki';
import { buildFormMap, foldToLemmas, rankDirectly, readFrequencyList } from './frequency';
import { mergeRanks, segmentCorpus } from './segment';
import { tierFor } from './difficulty';
import { capSenses, type CappedGroup } from './senses';
import { contextTagsFor } from './topics';
import { genderOf, articleOverrideFor } from './gender';
import { sequenceFor } from './sequence';
import { assembleExamples, readTatoeba, type TatoebaCorpus } from './examples';
import {
  applyOutcome,
  blockingFailures,
  normalizeTerm,
  resolve,
  type Registry,
  EMPTY_REGISTRY,
} from './registry';
import { pruneRegistry } from './registry';
import { buildCorePack } from './emit-core';
import { buildMeaningPack } from './emit-meaning';
import { buildReports, summarize, writeReports } from './reports';
import { buildManifest, writeManifest } from './manifest';
import { verifyPacks } from './verify';
import { LANGUAGES, readLock, sourcePath, verifyAgainstLock } from './sources';

export const REGISTRY_PATH = join('packs', 'registry.json');
export const OUTPUT_DIR = join('public', 'packs');

/** Entry targets. Vietnamese is lower because its Wiktionary coverage is thinner. */
export const TARGET_ENTRIES: Readonly<Record<string, number>> = Object.freeze({
  es: 10000,
  vi: 6000,
});

export interface BuildOptions {
  root: string;
  language: string;
  allowChurn?: boolean;
  /** Write nothing; report what would happen. */
  dryRun?: boolean;
  targetEntries?: number;
}

async function loadRegistry(root: string): Promise<Registry> {
  try {
    return JSON.parse(await readFile(join(root, REGISTRY_PATH), 'utf8')) as Registry;
  } catch {
    return EMPTY_REGISTRY;
  }
}

async function saveRegistry(root: string, registry: Registry): Promise<void> {
  await mkdir(join(root, 'packs'), { recursive: true });
  await writeFile(
    join(root, REGISTRY_PATH),
    `${JSON.stringify(registry, null, 2)}\n`,
    'utf8',
  );
}

/**
 * Choose which words make the pack.
 *
 * Walk the frequency ranking downward and take every capped group whose term is
 * at that rank, until the entry target is met. Selecting by rank rather than by
 * a fixed word list is what makes "the 5,000 most useful words" mean something,
 * and taking whole groups keeps a word's senses together — shipping `banco`
 * meaning bank but not bench would make the recognition vector unanswerable.
 */
function selectGroups(
  groups: readonly CappedGroup[],
  ranks: ReadonlyMap<string, number>,
  target: number,
): CappedGroup[] {
  const ranked = [...groups]
    .map((group) => ({ group, rank: ranks.get(normalizeTerm(group.term)) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.rank - b.rank || a.group.term.localeCompare(b.group.term));

  const chosen: CappedGroup[] = [];
  let entries = 0;

  for (const { group, rank } of ranked) {
    if (entries >= target) break;
    // An unranked word is absent from a subtitle corpus entirely; including
    // those would fill the pack with vocabulary nobody encounters.
    if (rank === Number.MAX_SAFE_INTEGER) continue;
    chosen.push(group);
    entries += group.kept.length;
  }

  return chosen;
}

export interface BuildResult {
  summary: string;
  entryCount: number;
  wrote: boolean;
  problems: string[];
}

export async function build(options: BuildOptions): Promise<BuildResult> {
  const { root, language } = options;
  const spec = LANGUAGES[language];
  if (!spec) throw new Error(`Unknown language "${language}"`);

  await verifyAgainstLock(root, language);

  const { candidates, formLinks, glosslessSenses } = await readKaikki(
    sourcePath(root, language, 'kaikki'),
    language,
  );

  const spec2 = LANGUAGES[language]!;
  const freqFormat = spec2.sources.find((s) => s.id === 'frequency')?.format ?? 'plain';
  const frequency = await readFrequencyList(sourcePath(root, language, 'frequency'), freqFormat);

  const groups = capSenses(candidates);

  // Terms that stand on their own, so the fold never dissolves one into a verb.
  const lemmaTerms = new Set(candidates.map((c) => normalizeTerm(c.term)));
  const formMap = buildFormMap(formLinks, lemmaTerms);

  let ranks: Map<string, number>;
  if (freqFormat === 'lemma-csv') {
    // Already lemma-keyed: rank it as it stands. No folding, and so none of the
    // defects folding introduced.
    ranks = rankDirectly(frequency);
  } else {
    ranks = foldToLemmas(frequency, formMap);
  }

  if (language === 'vi') {
    // Recover the polysyllabic vocabulary the syllable-token list cannot see.
    const compounds = new Set(
      groups.map((g) => normalizeTerm(g.term)).filter((t) => t.includes(' ')),
    );
    const { counts } = await segmentCorpus(
      sourcePath(root, language, 'tatoeba-sentences'),
      compounds,
    );
    ranks = mergeRanks(counts, ranks);
  }
  const target = options.targetEntries ?? TARGET_ENTRIES[language] ?? 5000;
  const selected = selectGroups(groups, ranks, target);

  let corpus: TatoebaCorpus | undefined;
  try {
    corpus = await readTatoeba(
      sourcePath(root, language, 'tatoeba-sentences'),
      sourcePath(root, language, 'tatoeba-links'),
      sourcePath(root, language, 'tatoeba-english'),
      formMap,
    );
  } catch {
    // Examples are best-effort by design: a missing corpus costs sentences, not
    // words, and the coverage report will say so.
    corpus = undefined;
  }

  const incoming = selected.flatMap((group) =>
    group.kept.map((sense) => ({
      language: sense.language,
      term: sense.term,
      partOfSpeech: sense.partOfSpeech,
      glosses: sense.glosses,
    })),
  );

  const registry = await loadRegistry(root);
  const outcome = resolve(registry, incoming);
  const blocking = blockingFailures(outcome, options.allowChurn);

  if (blocking.length > 0) {
    return {
      summary:
        `${language}: ${blocking.length} key problems — nothing written.\n` +
        blocking.slice(0, 20).map((f) => `  ${f.kind}: ${f.message}`).join('\n') +
        (blocking.length > 20 ? `\n  … and ${blocking.length - 20} more` : ''),
      entryCount: 0,
      wrote: false,
      problems: blocking.map((f) => f.message),
    };
  }

  const coreEntries: CorePackEntry[] = [];
  const meaningEntries: MeaningPackEntry[] = [];

  // Flattened once. `resolve` preserves input order, so assignment i belongs to
  // sense i — rebuilding this list inside the loop would be quadratic over
  // thousands of entries.
  const flatSenses = selected.flatMap((g) => g.kept);

  // The first sense of each (term, POS) — the only one a term-matched corpus
  // sentence can be trusted to illustrate.
  const primaryIndices = new Set<number>();
  let seen = 0;
  for (const group of selected) {
    primaryIndices.add(seen);
    seen += group.kept.length;
  }
  const primaryKeys = new Set(
    outcome.assignments.filter((_, i) => primaryIndices.has(i)).map((a) => a.key),
  );

  outcome.assignments.forEach((assignment, index) => {
    const sense = flatSenses[index];
    if (!sense) return;

    const gender = genderOf(sense);
    const article = articleOverrideFor(language, sense.term, gender);
    const sequence = sequenceFor(language, sense.term);
    const tags = contextTagsFor(sense.topics);
    const { core, translations } = assembleExamples(
      sense.term,
      sense.examples,
      corpus,
      primaryKeys.has(assignment.key),
    );

    coreEntries.push({
      key: assignment.key,
      term: sense.term,
      partOfSpeech: sense.partOfSpeech,
      difficulty: tierFor(sense, ranks),
      ...(tags.length > 0 ? { contextTags: tags } : {}),
      ...(sequence ? { sequence } : {}),
      ...(gender ? { gender } : {}),
      ...(article ? { article } : {}),
      ...(core.length > 0 ? { examples: core } : {}),
    });

    meaningEntries.push({
      key: assignment.key,
      meanings: sense.glosses,
      ...(Object.keys(translations).length > 0 ? { exampleTranslations: translations } : {}),
    });
  });

  const packVersion = new Date().toISOString().slice(0, 10);
  const corePack = buildCorePack({
    language,
    languageName: spec.kaikkiName,
    packVersion,
    entries: coreEntries,
    sources: spec.sources,
  });
  const meaningPack = buildMeaningPack({
    language,
    baseLanguage: 'en',
    packVersion,
    entries: meaningEntries,
  });

  const { problems } = verifyPacks(corePack, meaningPack);
  if (problems.length > 0) {
    return {
      summary:
        `${language}: the app would reject this pack — nothing written.\n` +
        problems.slice(0, 20).map((p) => `  ${p}`).join('\n'),
      entryCount: coreEntries.length,
      wrote: false,
      problems,
    };
  }

  const matchedTerms = new Set(coreEntries.map((e) => normalizeTerm(e.term)));
  const reports = buildReports({
    language,
    entries: coreEntries,
    groups: selected,
    churn: outcome.churn,
    frequencyHeadwords: ranks.size,
    unmatchedHeadwords: [...ranks.keys()].slice(0, target).filter((t) => !matchedTerms.has(t)).length,
    glosslessSenses,
  });

  const manifest = buildManifest({
    language,
    languageName: spec.kaikkiName,
    baseLanguage: 'en',
    packVersion,
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    entryCount: coreEntries.length,
    specs: spec.sources,
    locked: (await readLock(root))[language] ?? [],
    reports,
  });

  if (options.dryRun) {
    return {
      summary: `${summarize(reports)}\n  (dry run — nothing written)`,
      entryCount: coreEntries.length,
      wrote: false,
      problems: [],
    };
  }

  const outDir = join(root, OUTPUT_DIR);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, `${language}-core.json`), JSON.stringify(corePack), 'utf8');
  await writeFile(
    join(outDir, `${language}-meaning-en.json`),
    JSON.stringify(meaningPack),
    'utf8',
  );
  await writeManifest(join(outDir, `${language}-manifest.json`), manifest);
  await writeReports(join(outDir, `${language}-reports.json`), reports);
  await saveRegistry(root, applyOutcome(registry, outcome));

  return {
    summary: summarize(reports),
    entryCount: coreEntries.length,
    wrote: true,
    problems: [],
  };
}

export interface PruneReport {
  before: number;
  after: number;
  removed: number;
}

/**
 * Trim the registry to the keys the live packs actually use.
 *
 * Only safe before release. See `pruneRegistry` for why, and for what it gives
 * up. The caller is responsible for having asked the operator first.
 */
export async function prune(root: string): Promise<PruneReport> {
  const registry = await loadRegistry(root);
  const used = new Set<string>();

  for (const language of Object.keys(LANGUAGES)) {
    try {
      const pack = JSON.parse(
        await readFile(join(root, OUTPUT_DIR, `${language}-core.json`), 'utf8'),
      ) as { entries: { key: string }[] };
      for (const entry of pack.entries) used.add(entry.key);
    } catch {
      // A language with no built pack contributes no keys. Pruning against a
      // partial set would delete the other language's registry, so this refuses
      // below rather than guessing.
    }
  }

  if (used.size === 0) {
    throw new Error('No built packs found. Build every language before pruning.');
  }

  const result = pruneRegistry(registry, used);
  await saveRegistry(root, result.registry);

  return {
    before: registry.records.length,
    after: result.registry.records.length,
    removed: result.removed.length,
  };
}
