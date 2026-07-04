# Architectural Pauses

When to stop implementing and ask the user — versus when to just decide.

The rule from the SKILL.md is: pause immediately on architectural ambiguity. This file defines what counts as architectural ambiguity and what doesn't, with concrete examples for both. The point of pausing is that placement decisions cascade — a wrong choice early ripples into later steps.

## What requires a pause

These are decisions where the wrong call propagates beyond the current step. Always pause and ask.

**1. Where a new top-level type lives.**
The plan calls for `class InventoryService` but doesn't say which folder, namespace, or assembly. The choice between `Assets/Scripts/Services/`, `Assets/Scripts/Systems/`, and `Assets/Plugins/Game.Inventory/` is not interchangeable — it affects compile order, asmdef dependencies, and other code's ability to reach it.

**2. Whether something is a MonoBehaviour, ScriptableObject, or POCO.**
The plan describes behavior but doesn't say where it lives. A "manager" can be:
- A MonoBehaviour on a scene object → tied to scene lifecycle.
- A MonoBehaviour on a DontDestroyOnLoad singleton → survives scene changes.
- A ScriptableObject → asset-based, no GameObject.
- A POCO instantiated from somewhere → plain C# lifecycle.

Each has very different implications for scene reload, serialization, and access patterns. Pause.

**3. How a new system is reached from existing code.**
The plan says "Player should be able to query the inventory" but doesn't say how:
- Direct reference (`Inventory.Instance`).
- Injected dependency (constructor or `[SerializeField]`).
- Service locator.
- Event broadcast.

Pause — the project's existing pattern matters.

**4. Where in a scene/prefab hierarchy a new GameObject lives.**
The plan introduces a new GameObject but doesn't say whether it sits at scene root, under an existing manager object, or as part of a prefab. This affects activation order, serialized references in other components, and whether DontDestroyOnLoad applies.

**5. Which existing system to extend vs. create a new one.**
The plan calls for "hotkey support for the inventory" — should this go in the existing `InputRouter`, or a new `InventoryInputHandler`? The answer depends on the project's input architecture.

**6. Asmdef boundaries.**
A new type that touches both gameplay and UI: which asmdef does it live in? Creating it in the wrong place causes cyclic references that surface much later.

## What does NOT require a pause

These are decisions that stay local to a single file or method. The implementer can decide and (if it's non-obvious) record a Technical note.

- Method-internal local variable naming and scoping.
- Whether a helper method is `private` or `internal` (within a single file).
- The shape of a method's local data structures (List vs array vs Span, for a method that owns the lifetime).
- Choice of loop construct, exception handling style, or other purely-local idioms.
- Splitting a long method into smaller private helpers.
- Choosing `var` vs explicit type.

If a decision is local, just decide. If the user would have to look beyond one file to predict the consequences, pause.

## What to do in a pause

1. **Stop implementing.** Do not finish the current step "for now and come back".
2. **Identify all the placement questions at once.** If you've paused for one, look ahead in the plan for related ones — the user can answer them together.
3. **Ask the user, batched.** Include for each question:
   - The plan step it concerns.
   - 2–3 candidate options (with their tradeoffs).
   - Which option the implementer would default to if forced, and why.
4. **Wait for the answer.** Do not implement around the question and patch it later.

Example format:

```
I need a placement decision before continuing S3.

**Question:** Where should `InventoryService` live, and what kind of type is it?

Plan step S3 says "create InventoryService and register it for the player to query." The plan doesn't specify the type's nature.

Options I see:
- **Singleton MonoBehaviour on a DontDestroyOnLoad object** — matches the existing pattern for `AudioManager`. Easiest to access from anywhere but couples to scene lifecycle.
- **ScriptableObject asset** — matches `GameSettings`. Survives scene loads cleanly, but harder to discover at runtime without a registry.
- **POCO created by a bootstrapper** — cleanest separation, but requires plumbing through whatever creates it.

I'd default to option 1 (singleton MonoBehaviour) to match `AudioManager`, unless you'd prefer one of the others.
```

The user picks, the implementer notes the choice as a Technical note (with user confirmation per Phase 3), and implementation resumes.
