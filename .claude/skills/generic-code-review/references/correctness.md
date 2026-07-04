# Correctness Review Checklist

Highest priority. Read this when starting the correctness pass.

The principles below are language-agnostic. Apply them to the project's language using your domain knowledge of that language's idioms and failure modes (as recorded in `CLAUDE.md`'s `## Project Context`).

## Logic and control flow

- Off-by-one in loops, indexing, ranges.
- Inverted conditionals (`if (!x)` where `if (x)` was meant).
- Early returns that skip required cleanup.
- Switch/case fall-through (intentional or not) and missing default arm.
- Boolean operator precedence (`&&` vs `||`, mixed with negation).
- Integer division where floating-point was intended.
- Comparison of floats with `==` instead of an epsilon-based check.

## Null / absence handling

- Dereferencing a reference that can be null on at least one code path.
- Functions that return null/undefined/None for "not found" but callers don't check.
- Optional/Maybe/Option types unwrapped without checking the Some/None or Ok/Err discriminator.
- Dictionary/map access via `[]` that should have a presence check.
- Collection access without bounds checks.
- Type-system "any" / "object" / "dynamic" escape hatches used where null-safety was supposed to be enforced.
- For languages with null-safety (Kotlin, Swift, TypeScript strict, Rust): nullable types reaching code that expects non-null without explicit handling.

## Edge cases

- Empty collections, single-element collections.
- Zero, negative, and max values for numeric inputs.
- First-run-with-no-prior-state behavior.
- Concurrent operations on the same entity.
- Unicode, surrogate pairs, normalization for any string handling that goes beyond ASCII.
- Time/timezone correctness — naive datetimes mixed with timezone-aware ones, daylight-saving boundaries, leap seconds for high-precision timing.

## Concurrency and async

- Mutable state accessed from multiple threads/tasks without synchronization.
- `async` functions that don't await an inner `async` call (orphaned promises/tasks).
- Awaiting inside a lock (deadlock risk).
- Race conditions between check and act ("check if exists → create" pattern with no atomicity).
- Cancellation not propagated through async chains.
- Background tasks not awaited or tracked, then orphaned.
- Blocking calls inside async/event-loop code paths.

## Error handling

- `catch` / `except` blocks that swallow errors silently (no log, no rethrow, no recovery).
- Catching too broad an error type (`catch (Exception)`, `except:`, `catch (...)` ) when only specific errors were expected.
- Resources not released on the error path (missing `finally` / `defer` / RAII / `using`).
- Errors caught and replaced with less informative ones, losing the underlying cause.
- Exceptions thrown from places where the caller cannot reasonably handle them (e.g. destructors, finalizers, error handlers themselves).
- Functions that mix error-via-return and error-via-throw inconsistently.

## Type safety

- Implicit conversions that lose information (large int to int32, float to int, signed to unsigned).
- Pattern matches that don't cover all variants (and the compiler isn't catching it).
- Casts that assert without checking.
- Generic type parameters constrained too weakly, accepting types that don't satisfy the function's real requirements.

## State and lifecycle

- Initialization order assumptions across modules or constructors.
- State that persists across invocations when it shouldn't (or vice versa).
- Singletons or global mutable state holding references that prevent GC or leak across tests.
- Cached references to entities that may be invalidated (deleted DB rows, expired sessions, closed connections).

## I/O and resources

- File handles, network sockets, database connections not closed on every path.
- Buffers not flushed before close.
- Reads that don't handle partial data (short reads on streams).
- Writes that don't handle backpressure or partial writes.

## Plan correspondence

- Plan said "X will be called from Y" — verify Y actually calls X.
- Plan said "behavior B will be removed" — verify B is gone, including overrides, listeners, or registered callbacks.
- Plan said "method M handles case C" — verify the code path for C reaches M.
- Plan said "validate input I" — verify the validation actually runs before I is used.

## Language- and framework-specific footguns

This is where the reviewer's domain knowledge of the project's language and stack does the heavy lifting. Apply expertise for what's commonly known to bite in this environment. A few illustrative categories (not exhaustive):

- **Web backends:** missing input validation on user-supplied fields; SQL/NoSQL injection vectors; missing CSRF protection; auth checks skipped on a code path; over-fetching from the database (N+1); missing transactional boundary on multi-step state changes.
- **Frontend:** stale closures in hooks, missing dependency arrays, unhandled promise rejections, race conditions between unmount and async resolve.
- **Systems / Rust:** lifetimes that compile but leak references through unsafe blocks; mutex held across `.await`; `unwrap()` on results that can fail at runtime.
- **Distributed:** at-least-once semantics where exactly-once was assumed; retries without idempotency; clocks compared across machines.
- **Mobile:** activity/view lifecycle bugs where state survives across recreations unintentionally (or fails to survive when it should).

If the project's language is in `## Project Context`, apply the relevant subset. If CLAUDE.md's `### Reviewer` subsection names additional project-specific footguns, those apply too.
