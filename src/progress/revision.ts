/**
 * The profile revision counter.
 *
 * Its own module purely to break a cycle: `progress-repo` opens the mass-edit
 * transaction and so must import the snapshot repository, while the snapshot
 * repository needs to bump the revision. Both now depend on this instead of on
 * each other.
 *
 * Bumped on every mutation. Nothing in v1 reads it, which is fine — it costs one
 * integer and is impossible to reconstruct after the fact, and it is what a
 * future sync uses to tell which device is newer (architecture.md, seam 4).
 */

import { db } from '../database';

const REVISION_KEY = 'profileRevision';

export async function getRevision(): Promise<number> {
  const row = await db.settings.get(REVISION_KEY);
  return typeof row?.value === 'number' ? row.value : 0;
}

/** Callable inside a transaction the caller already opened. */
export async function bumpRevisionInTransaction(): Promise<void> {
  const row = await db.settings.get(REVISION_KEY);
  const next = (typeof row?.value === 'number' ? row.value : 0) + 1;
  await db.settings.put({ key: REVISION_KEY, value: next });
}

export async function bumpRevision(): Promise<number> {
  await bumpRevisionInTransaction();
  return getRevision();
}
