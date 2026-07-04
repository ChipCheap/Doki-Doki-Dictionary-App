# Unity-Specific Checklist

Unity has recurring defect patterns that don't exist in plain C#. Walk this list during the review.

## Update loop hygiene

- Allocations in `Update`, `LateUpdate`, `FixedUpdate` — string concatenations, `new List<T>()`, LINQ, `foreach` over non-list IEnumerables, lambdas capturing variables. These cause per-frame GC pressure.
- `GetComponent`, `GetComponentInChildren`, `FindObjectOfType`, `GameObject.Find` called per frame. These should be cached in `Awake`/`Start`.
- `Camera.main` in `Update` — does an internal lookup. Cache it.
- `transform` accessed many times in one frame — local variable it once.
- Debug.Log in `Update` left in from debugging.

## FixedUpdate / physics

- Physics calls (`Rigidbody.AddForce`, `MovePosition`, raycasts that affect physics state) in `Update` instead of `FixedUpdate`.
- Reading input in `FixedUpdate` — input should be sampled in `Update` and consumed in `FixedUpdate`.
- `Time.deltaTime` used in `FixedUpdate` instead of `Time.fixedDeltaTime`.

## Coroutines

- Coroutine started on a component that gets disabled — coroutine stops silently. If the work must continue, run it on a different host or use a task.
- Coroutine started on a destroyed GameObject — will throw.
- Coroutines that yield `null` every frame when they could yield `WaitForSeconds` and reduce overhead.
- Allocating `new WaitForSeconds(x)` inside a loop — cache it.
- Coroutine references not tracked, so they can't be stopped on demand.

## Unity null equality

- `UnityEngine.Object.==` is overridden to also return true when the object has been destroyed in C++ but the managed reference still exists. This means:
  - `obj?.Foo()` will **still call** `Foo()` on a destroyed object because `?.` checks managed null, not Unity null.
  - `obj ?? fallback` will return the destroyed `obj`, not the fallback.
  - Always use `if (obj == null)` for Unity objects.
- Comparing two `UnityEngine.Object`s with `ReferenceEquals` bypasses the override and may give wrong answers.

## Serialization

- `[SerializeField]` on a property — only fields serialize.
- Renaming a serialized field without `[FormerlySerializedAs]` — silently loses inspector data.
- Public fields that should be `[SerializeField] private`.
- Non-serializable types (Dictionary, interfaces, generic List<T> of non-serializable T) expected to show in the Inspector.
- Reference types initialized only at declaration — Unity may bypass the initializer on deserialization.

## Events and delegates

- Subscribing to an event in `OnEnable` without unsubscribing in `OnDisable` — causes leaks and "ghost" invocations after destroy.
- Subscribing in `Start` and unsubscribing in `OnDestroy` (mismatched lifecycle).
- UnityEvent inspector wiring referencing methods that were renamed — silently breaks.
- Static events holding instance handlers — prevents GC of the instance.

## Resource and asset references

- `Resources.Load` for assets that could be direct references — slower and brittle.
- Instantiating prefabs without parenting, then re-parenting — triggers extra transform recalculation. Pass parent to `Instantiate`.
- `Destroy` vs `DestroyImmediate` — `DestroyImmediate` is for editor code only.
- Material instances created via `renderer.material` — leaks unless explicitly destroyed; use `sharedMaterial` when modification isn't needed.

## Scene and lifecycle

- DontDestroyOnLoad on a child of a non-root object — silently does nothing.
- Singleton patterns that don't handle scene reload or duplicate instantiation.
- `OnDestroy` doing work that requires the scene to still exist — order isn't guaranteed during shutdown.
- `Awake`/`OnEnable` ordering across components on the same GameObject is not guaranteed unless script execution order is configured.

## Editor vs build

- `#if UNITY_EDITOR` code referenced from runtime code without matching guards.
- `UnityEditor` namespace usage outside an Editor folder or editor-only assembly.
- Asset database calls at runtime.
