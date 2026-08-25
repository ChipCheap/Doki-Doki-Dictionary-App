/**
 * S15 — build reports.
 *
 * Five, not the framework's four. Homographs, sense cap, example coverage and
 * source coverage all describe pack QUALITY — how good the data is. Key churn
 * describes whether anyone's progress just moved, which is the only failure here
 * that a user can neither see nor recover from, so it is reported separately
 * and, unlike the others, can stop the build.
 */

import { writeFile } from 'node:fs/promises';
import type { CorePackEntry } from '../../src/dictionary/pack-format';
import type { CappedGroup } from './senses';
import type { Churn } from './registry';
import { normalizeTerm } from './registry';

export interface Reports {
  language: string;
  homographs: { term: string; entries: number }[];
  senseCap: { term: string; partOfSpeech: string; dropped: string[]; reason: string }[];
  exampleCoverage: { total: number; withTwo: number; withOne: number; withNone: number };
  sourceCoverage: {
    frequencyHeadwords: number;
    unmatchedHeadwords: number;
    glosslessSenses: number;
  };
  keyChurn: Churn;
  contextTagCoverage: { tagged: number; total: number; percent: number };
}

export function buildReports(input: {
  language: string;
  entries: readonly CorePackEntry[];
  groups: readonly CappedGroup[];
  churn: Churn;
  frequencyHeadwords: number;
  unmatchedHeadwords: number;
  glosslessSenses: number;
}): Reports {
  const byTerm = new Map<string, number>();
  for (const entry of input.entries) {
    const term = normalizeTerm(entry.term);
    byTerm.set(term, (byTerm.get(term) ?? 0) + 1);
  }

  const exampleCoverage = { total: input.entries.length, withTwo: 0, withOne: 0, withNone: 0 };
  for (const entry of input.entries) {
    const n = entry.examples?.length ?? 0;
    if (n >= 2) exampleCoverage.withTwo += 1;
    else if (n === 1) exampleCoverage.withOne += 1;
    else exampleCoverage.withNone += 1;
  }

  const tagged = input.entries.filter((e) => (e.contextTags?.length ?? 0) > 0).length;

  return {
    language: input.language,
    homographs: [...byTerm.entries()]
      .filter(([, n]) => n > 1)
      .map(([term, entries]) => ({ term, entries }))
      .sort((a, b) => b.entries - a.entries || a.term.localeCompare(b.term)),
    senseCap: input.groups
      .filter((g) => g.dropped.length > 0)
      .map((g) => ({
        term: g.term,
        partOfSpeech: g.partOfSpeech,
        dropped: g.dropped.map((d) => d.sense.glosses[0] ?? ''),
        reason: [...new Set(g.dropped.map((d) => d.reason))].join(', '),
      })),
    exampleCoverage,
    sourceCoverage: {
      frequencyHeadwords: input.frequencyHeadwords,
      unmatchedHeadwords: input.unmatchedHeadwords,
      glosslessSenses: input.glosslessSenses,
    },
    keyChurn: input.churn,
    contextTagCoverage: {
      tagged,
      total: input.entries.length,
      percent: input.entries.length === 0 ? 0 : Math.round((tagged / input.entries.length) * 1000) / 10,
    },
  };
}

export async function writeReports(path: string, reports: Reports): Promise<void> {
  await writeFile(path, `${JSON.stringify(reports, null, 2)}\n`, 'utf8');
}

/** The summary a human actually reads after a build. */
export function summarize(reports: Reports): string {
  const e = reports.exampleCoverage;
  const c = reports.keyChurn;
  const pct = (n: number): string =>
    e.total === 0 ? '0%' : `${Math.round((n / e.total) * 100)}%`;

  return [
    `${reports.language}: ${e.total} entries`,
    `  examples     two ${pct(e.withTwo)} · one ${pct(e.withOne)} · none ${pct(e.withNone)}`,
    `  context tags ${reports.contextTagCoverage.percent}% of entries tagged`,
    `  homographs   ${reports.homographs.length} terms carry more than one entry`,
    `  sense cap    ${reports.senseCap.length} words had senses dropped`,
    `  source       ${reports.sourceCoverage.unmatchedHeadwords} frequency headwords had no usable entry`,
    `  key churn    ${c.minted.length} minted · ${c.matched.length} matched · ${c.orphaned.length} orphaned` +
      (c.firstBuild ? ' (first build)' : ''),
  ].join('\n');
}
