# Unity Implementation Idioms

Conventions the implementer should follow when writing Unity C#. The reviewer's checklists are more exhaustive (see the unity-code-review skill); this file is what the implementer applies *as they write*, so the reviewer has less to catch.

## Component references

- **Cache `GetComponent` and friends in `Awake` or `Start`.** Never call them in `Update`, `FixedUpdate`, or `LateUpdate`.
- **Cache `transform`.** Repeated access in one frame turns into many native lookups; one local variable removes that cost.
- **Cache `Camera.main`.** It does a tag-based scene lookup every call.
- **Use `[SerializeField] private` for designer-set references.** Avoid raw public fields for this purpose; the serialization works either way, but `[SerializeField] private` documents intent.
- **Use `RequireComponent` when the component depends on another on the same GameObject.** It prevents accidental removal in the inspector.

## Lifecycle

- **`Awake`:** initialize self, get own component references. Do not assume other components have been initialized yet.
- **`Start`:** initialize anything that depends on other components being initialized.
- **`OnEnable` / `OnDisable`:** subscribe/unsubscribe to events. They run on every enable/disable, not just at instantiation.
- **`OnDestroy`:** release non-managed resources. Note: scene shutdown order is not guaranteed, so don't assume specific other objects still exist.
- **`OnValidate`:** editor-time validation only. Never put gameplay logic here.

For event subscription, prefer `OnEnable`/`OnDisable` over `Start`/`OnDestroy`. The former pair handles disable/re-enable cycles correctly; the latter pair leaks subscriptions across disables.

## Coroutines

- **Cache `WaitForSeconds` instances if reused.** `new WaitForSeconds(0.1f)` inside a loop allocates every iteration.
- **Hold the `Coroutine` reference** if you might need to stop it.
- **Be wary of coroutines on disabled GameObjects** — they stop silently. If the work must continue, run the coroutine on a parent or manager.

## Allocations

In any code path called frequently (every frame, per physics tick, per event in a high-volume stream):

- No `string` concatenation. Use `StringBuilder`, or cache the string.
- No LINQ (`Where`, `Select`, `ToList`).
- No `foreach` over non-array, non-`List<T>` `IEnumerable`s.
- No lambdas capturing local variables.
- No `new` on collection types — reuse a cached buffer.
- No boxing (struct passed to `object` parameter, struct in non-generic collection).

If a path isn't called frequently, normal C# style applies; don't make rare code ugly to save a few bytes.

## Physics

- Physics calls (`Rigidbody.AddForce`, `MovePosition`, raycasts that affect physics state) belong in `FixedUpdate`, not `Update`.
- Input should be sampled in `Update` (where it's frame-accurate) and consumed in `FixedUpdate` (where physics happens).
- Use `Time.fixedDeltaTime` in `FixedUpdate`, `Time.deltaTime` elsewhere.
- Use `*NonAlloc` variants of physics queries (`RaycastNonAlloc`, `OverlapSphereNonAlloc`) with a cached buffer when the call happens repeatedly.

## Unity null semantics

`UnityEngine.Object`'s `==` operator is overridden. Implications:

- `obj?.Foo()` does **not** behave like a normal C# null-conditional — `?.` checks managed null, not Unity's "destroyed" state. A destroyed object can still get `Foo()` called.
- `obj ?? fallback` returns the destroyed `obj`, not `fallback`.
- Always use `if (obj == null)` or `if (obj != null)` for `UnityEngine.Object` references.

## Serialization

- `[SerializeField]` works only on fields, not properties.
- Renaming a serialized field loses Inspector data unless `[FormerlySerializedAs]` is added with the old name.
- Reference types initialized only at declaration may be bypassed during deserialization; initialize in `Reset` or `OnValidate` for editor-time, or `Awake` for runtime, if the field must be non-null.
- `Dictionary<,>`, interfaces, and complex generics don't serialize. Use Unity's `SerializeReference` carefully or wrap in a serializable container.

## Events

- Subscribe in `OnEnable`, unsubscribe in `OnDisable` — symmetric, handles disable cycles.
- Static events holding instance handlers prevent GC of the instance. Always unsubscribe.
- Inspector-wired `UnityEvent` references can silently break if the target method is renamed. Whenever renaming a UnityEvent target, the implementer must check the prefab/scene wiring (and flag it as a Technical note if a manual rewire was needed).

## String identifiers

- Tag, layer, animator parameter, and shader property strings should be cached:
  - Tags: hardcoded string is acceptable but should appear in a constants class if used in more than one place.
  - Animator: convert once via `Animator.StringToHash`, store the int.
  - Shader: convert once via `Shader.PropertyToID`, store the int.
- Magic numbers for physics, timing, input thresholds → named constants with a clear unit suffix where applicable (`SpeedMps`, `ChargeDurationSeconds`).

## Where things live

The plan dictates file placement at the step level. Inside a file:

- One public type per file when possible. Nested helper types are fine; multiple top-level public types in one file are not.
- Namespace matches folder structure if CLAUDE.md says so; otherwise follow the project's existing pattern.
- Using directives sorted: System first, UnityEngine and Unity packages next, project namespaces last. Remove unused directives during Phase 6 cull.

## What this file is not

This is **not** a replacement for the reviewer's checklists. The reviewer catches what slips through; the implementer just shouldn't make the reviewer's job harder by violating well-known idioms.

If something in this file conflicts with `CLAUDE.md`, CLAUDE.md wins.
