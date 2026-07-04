# Correctness Review Checklist

Highest priority. Read this when starting the correctness pass.

## Logic and control flow

- Off-by-one in loops, indexing, ranges.
- Inverted conditionals (`if (!x)` where `if (x)` was meant).
- Early returns that skip required cleanup.
- Switch/case fall-through (intentional or not) and missing `default`.
- Boolean operator precedence (`&&` vs `||`, mixed with `!`).
- Integer division where floating-point was intended.
- Comparison of floats with `==` instead of `Mathf.Approximately` or epsilon.

## Null handling

- Dereferencing a reference that can be null on at least one code path.
- Methods that return null for "not found" but callers don't check.
- `out` parameters used without checking the bool return.
- Dictionary access via `[]` that should be `TryGetValue`.
- Collection access without bounds checks.
- **Unity-specific:** comparing a destroyed `UnityEngine.Object` with `?.` or `??` — these do **not** behave like normal C# null checks because Unity overrides `==`. Use explicit `if (obj == null)` for Unity objects. See `unity-checklist.md`.

## Edge cases

- Empty collections, single-element collections.
- Zero, negative, and max values for numeric inputs.
- First-frame and last-frame behavior in Unity lifecycle.
- Disabled or inactive GameObjects.
- Components attached to destroyed objects.
- Time.deltaTime == 0 on the first frame after a pause/load.

## Concurrency and async

- Mutable state accessed from multiple threads without synchronization.
- `async void` outside of event handlers.
- Awaiting inside a lock.
- Coroutines that assume single-instance but can be started multiple times.
- `Task` continuations that touch Unity APIs off the main thread.

## Exception handling

- `catch` blocks that swallow exceptions silently.
- `catch (Exception)` where a specific exception type was intended.
- Resources not disposed on the exception path (missing `using` or `try/finally`).
- Exceptions thrown from constructors of `MonoBehaviour` (Unity will keep the broken component).

## State and lifecycle

- Initialization order: `Awake` vs `Start` vs `OnEnable` assumptions.
- State that persists across scene loads when it shouldn't (or vice versa).
- Static fields holding references that prevent GC or survive domain reload incorrectly.
- Cached references to objects that get destroyed.

## Plan correspondence

- Plan said "X will be called from Y" — verify Y actually calls X.
- Plan said "behavior B will be removed" — verify B is gone, including overrides and event subscriptions.
- Plan said "method M handles case C" — verify the code path for C reaches M.
