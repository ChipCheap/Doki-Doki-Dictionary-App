/**
 * An in-memory IndexedDB for the repository tests.
 *
 * Dexie is a wrapper over the BROWSER's IndexedDB and carries no storage engine
 * of its own, so under Vitest — which runs in Node — `indexedDB` is simply not
 * defined. `fake-indexeddb/auto` installs a spec-compliant implementation on the
 * global object, which is what lets the atomicity and swap properties be tested
 * against the real Dexie transaction machinery rather than against a mock.
 *
 * Domain tests need none of this; they are pure functions and were always
 * testable without a database.
 */

import 'fake-indexeddb/auto';
