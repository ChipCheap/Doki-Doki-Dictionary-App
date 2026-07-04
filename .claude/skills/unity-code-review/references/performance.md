# Performance Review Checklist

Focus on issues likely to matter in practice — per-frame, per-object, per-tick work. Don't flag micro-optimizations that won't show up on a profiler.

## Per-frame allocations

These create GC pressure that shows up as frame hitches:

- `string` concatenation in `Update` / `OnGUI` / `LateUpdate`. Use `StringBuilder`, cached strings, or `string.Format` with care.
- LINQ in hot paths (`Where`, `Select`, `ToList`) — allocates iterators and arrays.
- `foreach` over non-array, non-List<T> IEnumerables — allocates an enumerator.
- Lambdas that capture local variables — each invocation allocates a closure.
- Boxing: passing a struct to a method that takes `object`, or storing a struct in a non-generic collection.
- `new List<T>()` / `new T[]` per frame instead of reusing a buffer.
- `params` calls with non-empty argument arrays — allocates the array.

## Hot path lookups

- `GetComponent`, `GetComponentInChildren`, `GetComponentsInChildren` per frame — cache.
- `FindObjectOfType`, `GameObject.Find`, `GameObject.FindWithTag` per frame — cache, or use a registry pattern.
- `Camera.main` per frame — cache.
- `transform.position` accessed many times — local-variable it.
- Dictionary lookups in hot paths where an array index would do.

## Physics

- Per-frame `Physics.Raycast` from many objects — consider `RaycastNonAlloc`, batching, or `Physics.SyncTransforms` awareness.
- Allocating `Collider[]` for `OverlapSphere` per call — use the `NonAlloc` variants with a cached buffer.
- Unnecessary `Rigidbody.WakeUp` / sleep churn.

## Rendering

- Many small SpriteRenderers / Renderers with different materials breaking batching.
- `Material.SetColor` / `SetFloat` per frame creating material instances — use `MaterialPropertyBlock`.
- Animator parameters set by string name in hot paths — use `Animator.StringToHash` once and reuse the int.
- Setting UI Text via `text` property every frame even when the value hasn't changed — Canvas rebuild is expensive.

## Data structures

- `List.Remove(item)` or `Contains` in a hot path — O(n). Use `HashSet` or swap-remove if order doesn't matter.
- Repeatedly converting between containers (`ToList`, `ToArray`).
- Reallocating buffers that could be pre-sized with capacity.

## Loading

- Synchronous `Resources.Load` of large assets at gameplay-critical moments.
- `Instantiate` of complex prefabs without pooling, in spawn-heavy systems.
- Awaitable async patterns that block on the main thread.

## What not to flag

- Micro-optimizations with no measurable effect (e.g. `i++` vs `++i`, for vs foreach over a `List<T>`).
- "Could be faster" without a real cost path — only flag if the code is in a hot path or at scale.
- Preallocation that would hurt readability for no real benefit.
