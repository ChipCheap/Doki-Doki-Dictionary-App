/**
 * S16 — the conformance gate.
 *
 * Runs the APP'S OWN validators over what the generator produced, before
 * anything is written. That makes the app the arbiter of its own input: a pack
 * that would silently lose entries at install never reaches disk, and a change
 * to `pack-format.ts` breaks the build here rather than on a user's machine.
 */

import {
  validateCoreEntries,
  validateMeaningEntries,
  type CorePack,
  type MeaningPack,
} from '../../src/dictionary/pack-format';

export interface VerifyResult {
  problems: string[];
}

const KEY_SHAPE = /^[a-z]{2,3}:[^:]+:[^:]+:\d+$/;

export function verifyPacks(core: CorePack, meaning: MeaningPack): VerifyResult {
  const problems: string[] = [];

  const coreOutcome = validateCoreEntries(core.entries);
  for (const skipped of coreOutcome.skipped) {
    problems.push(`core entry ${skipped.key} would be dropped at install: ${skipped.reason}`);
  }

  const meaningOutcome = validateMeaningEntries(meaning.entries);
  for (const skipped of meaningOutcome.skipped) {
    problems.push(`meaning entry ${skipped.key} would be dropped at install: ${skipped.reason}`);
  }

  for (const entry of core.entries) {
    if (!KEY_SHAPE.test(entry.key)) {
      problems.push(`key "${entry.key}" is not lang:term:pos:ordinal`);
    }
  }

  // A meaning layer keyed to an entry the core does not carry is unstudiable —
  // the app merges on key, so the meaning would simply never be found.
  const coreKeys = new Set(core.entries.map((e) => e.key));
  for (const entry of meaning.entries) {
    if (!coreKeys.has(entry.key)) {
      problems.push(`meaning layer carries ${entry.key}, which the core layer does not`);
    }
  }

  // The reverse is legal but worth naming: the framework says a core entry
  // without a meaning is simply not studiable yet.
  const meaningKeys = new Set(meaning.entries.map((e) => e.key));
  const unstudiable = core.entries.filter((e) => !meaningKeys.has(e.key));
  if (unstudiable.length > 0) {
    problems.push(
      `${unstudiable.length} core entries have no meaning and would not be studiable ` +
        `(first: ${unstudiable[0]!.key})`,
    );
  }

  if (core.language !== meaning.language) {
    problems.push(`core is ${core.language} but the meaning layer is for ${meaning.language}`);
  }

  return { problems };
}
