# Implementation Idioms

General implementation idioms that apply across languages. Language-specific idioms are part of the implementer's domain knowledge — apply them as you would in any project of that language, guided by the `## Project Context` section of `CLAUDE.md`.

This file is what the implementer applies *as they write*, so the reviewer has less to catch.

## Resource lifecycle

- **Symmetric acquisition and release.** Anything you open, you close. Anything you acquire, you release. Use the language's idiomatic mechanism: `with` in Python, `try-with-resources` in Java, `defer` in Go, `using` in C#, RAII in Rust, scoped subscribers in Reactive, etc.
- **Release on every path.** Including the exception/error path. Use language constructs that guarantee release (`try/finally`, `defer`, scoped guards) rather than relying on remembering to release at every return.
- **Don't rely on garbage collection for non-managed resources.** File handles, network sockets, database connections, locks, subscriptions — release them deterministically. GC eventually frees memory; it does not necessarily free OS resources promptly.

## Caching and repeated lookups

- **Cache expensive lookups outside hot loops.** If something is computed once per call but the call is in a tight loop, hoist the computation outside the loop.
- **Be aware of when caching is safe.** Caching a value that changes between calls is a defect, not an optimization. If you're caching, you're asserting that the value doesn't change for the duration of the cache.
- **Don't pre-cache things that may never be needed.** Lazy evaluation is often better than eager. Cache when the cost of the second lookup outweighs the cost of holding the cached value.

## Error handling

- **Use the language's idiomatic error mechanism.** Exceptions in Python/Java/C#, Result types in Rust, multiple return values in Go, etc. Don't fight the language.
- **Don't swallow errors silently.** A `catch` block with no logging, rethrow, or recovery is almost always wrong.
- **Match the exception type to the situation.** Catching `Exception` (or its language equivalent) when you only know how to handle one specific error masks bugs.
- **Resources released on the error path** (see "Resource lifecycle" above).
- **Errors propagated, not invented.** If a deeper layer returns an error, the upper layer's job is usually to enrich it (add context), not replace it with something less informative.

## State management

- **Initialize before use.** Either at declaration, in a constructor, or in a clearly-named initialization step. Don't rely on members being set by some external caller "later".
- **Mutability is a choice.** Make types immutable when there's no reason for them to mutate. The reviewer will flag mutable state that should have been immutable.
- **Locality of state.** State that lives close to its only user is easier to reason about than state shared across the codebase.
- **No hidden shared state.** Module-level mutable globals, singletons that hide their reachability, "manager" classes that store everything — these make change hard. Prefer explicit passing.

## Concurrency and async

- **Don't share mutable state across threads/tasks without synchronization.** Use the language's safe primitives (channels, mutexes, atomics, immutable types).
- **Don't block in async code paths.** A blocking call inside an `async` function defeats the point and can deadlock the event loop.
- **Cancellation has to be plumbed through.** If the language has a cancellation token / context / abort signal, accept and forward it. Don't hardcode "run forever" loops in cancelable contexts.

## Naming and structure

- **Names express intent, not implementation.** `tmp`, `data`, `value`, `x` are usually wrong unless the surrounding code makes the meaning obvious. `firstUnreadMessageId` reads better than `id`.
- **One responsibility per function.** If a function's name has "and" in it, consider whether it's two functions.
- **Layering is intentional.** If you find yourself adding "and now this layer needs to know about that layer's details", that's usually a sign the layer boundary is in the wrong place.

## Hot paths and performance

- **Identify hot paths.** Code that runs once at startup is different from code that runs once per request, which is different from code that runs once per item in a batch.
- **In hot paths, avoid:**
  - Repeated allocation that could be amortized (reused buffers, pooled objects).
  - Repeated string concatenation that could use a builder or join.
  - Repeated parsing/compilation that could be done once.
  - Repeated I/O that could be batched.
- **In non-hot paths, don't over-optimize.** Readability wins. The reviewer will only flag performance issues in paths where it matters.

## Following project conventions

- **Use what's already there.** If the project uses a specific HTTP client, ORM, logging framework, validation library — use the same one. Introducing a second one of anything has a real cost.
- **Respect existing patterns.** If every other module exports a single default function, your new module probably should too.
- **CLAUDE.md is authoritative for project-specific style.** Read it carefully. The `### Implementer` subsection of `## Skill Behaviors` may add project-specific rules — apply those on top of generic idioms.

## What this file is not

This is **not** a replacement for the reviewer's checklists. The reviewer catches what slips through; the implementer just shouldn't make the reviewer's job harder by violating well-known idioms.

If something in this file conflicts with CLAUDE.md, CLAUDE.md wins.
