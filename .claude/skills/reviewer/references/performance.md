# Performance Review Checklist

Focus on issues likely to matter in practice — per-request, per-iteration, per-tick work. Don't flag micro-optimizations that won't show up on a profiler.

The hot-path concept is universal but its shape varies: per-frame in real-time systems, per-request in web backends, per-message in event handlers, per-item in batch jobs. Identify what counts as "hot" for the project's language and domain, then apply the principles below to those paths.

## Allocations in hot paths

In any code path called frequently:

- Object construction that could be pooled or reused.
- String concatenation that could use a builder or pre-sized buffer.
- Collection operations that allocate intermediate results (functional-style chains that create temporary collections at each step).
- Closures that capture variables from outer scope, allocating a closure object per invocation.
- Boxing of value types into reference types (in languages where this matters: C#, Java auto-boxing, Go interface{}).

These create memory pressure that shows up as GC pauses, latency spikes, or throughput ceilings depending on the runtime.

## Hot path lookups

- Reflection / introspection inside hot paths (call attribute resolution, runtime type dispatch).
- Singleton or service-locator lookups that could be cached at construction.
- Configuration or settings lookups by string key inside loops.
- Repeated parsing of the same input (regex compile, schema parse, URL parse).
- Hash map lookups in inner loops where the key never changes — hoist outside.

## I/O patterns

- **N+1 queries:** loop that calls the database/API once per item where a batch fetch would do.
- **Synchronous I/O in async code:** blocking the event loop.
- **Missing pagination:** loading entire collections from the database when only a page is needed.
- **No batching:** writes done one at a time when the backend supports batch operations.
- **No caching:** identical reads repeated when the result is stable.

## Data structures

- `List.contains(x)` or `array.includes(x)` in a hot path — O(n). Use a hash set if the membership check is repeated.
- Repeatedly converting between containers (`toList`, `toArray`, `Object.fromEntries`).
- Reallocating buffers that could be pre-sized with capacity (when the size is known).
- Linked lists where array-like access would be faster, or vice versa.

## Concurrency overhead

- Locks held longer than necessary (held across I/O or computation that doesn't need the lock).
- Lock contention on a single mutex protecting unrelated state — consider sharding.
- Atomic operations where a regular mutex would be simpler and not measurably slower.
- Spawning threads/tasks per item where a worker pool would amortize the cost.

## Computation

- Recomputation of values that could be memoized (when the input space is bounded).
- Sorting or grouping done multiple times on the same data.
- Doing work eagerly when lazy evaluation would suffice.
- Conversely: doing work lazily that ends up being computed many times — sometimes the eager path is cheaper overall.

## Language-specific performance patterns

This is where the reviewer's domain knowledge of the language matters. A few illustrative categories — apply the appropriate ones based on the project's language and stack:

- **Python:** loops in pure Python where vectorized NumPy/pandas would be orders of magnitude faster; misuse of `pickle` for high-throughput serialization; GIL-bound code where multiprocessing or async would help.
- **JavaScript/TypeScript:** deep object spreads in render loops; `Array.find` in tight loops; unnecessary re-renders in React.
- **Java/JVM:** primitive vs boxed types in hot loops; reflection inside frequently called code; stream operations creating intermediate collections.
- **Go:** repeated `append` to a slice without pre-sizing; string concatenation with `+` instead of `strings.Builder`; goroutine leaks from unbounded spawning.
- **Rust:** unnecessary `.clone()` calls; allocation when a borrow would do; iterator chains that collect intermediate results.
- **C#:** LINQ allocations in hot paths; async without `ConfigureAwait(false)` in library code; string concatenation without `StringBuilder` for large strings.

If `## Project Context` names the language, apply the relevant subset.

## What not to flag

- Micro-optimizations with no measurable effect.
- "Could be faster" without a real cost path — only flag if the code is in a hot path or at scale.
- Preallocation that would hurt readability for no real benefit.
- Premature optimization warnings on code that is clearly not hot.
