# Unused Code Rules

What to cull, what to TODO, what to leave alone. Plus the Unity reflection-aware checklist that prevents culling members the engine wires up invisibly.

## Scope rule (strict)

**Only within the changeset.** Files the implementer created or modified during this implementation pass are in scope. Everything else is off-limits, regardless of how obviously dead it looks. Cleaning up unrelated dead code is a separate cycle's problem.

"Modified" means actually changed in this pass. Reading a file or opening it does not put it in scope.

## Decision tree

For each apparently-unused element inside the changeset:

```
1. Is it reflection-driven, inspector-wired, or otherwise engine-invoked?
   → YES: Leave it alone. Do not cull. Do not TODO.

2. Is it part of an interface contract (must exist even if empty)?
   → YES: Leave it. Add a TODO if the body is empty.

3. Did the plan explicitly introduce it for use in this iteration?
   → YES (used in iteration): If something in this iteration uses it, it's
                              not unused. Skip.
   → YES (planned for later): Keep it. Add // TODO referencing the plan step.
                              Add to "Unused-but-required" in summary.

4. Did the plan explicitly introduce it for a future iteration?
   → YES: Keep. Add // TODO referencing the plan step.
          Add to "Unused-but-required" in summary.

5. Is it incidental — neither plan-mandated nor engine-wired — and genuinely
   unused inside the changeset?
   → YES: Cull silently. Record in summary's "Culled" list.

6. Can't classify confidently?
   → Ask the user. Do not cull. Do not TODO autonomously.
```

## Unity reflection-aware checklist

The Unity engine wires many members via mechanisms invisible to static analysis. **Do not cull these,** even if no caller appears anywhere in the C# source:

**Serialization:**
- `[SerializeField] private` fields — assigned in the Inspector.
- `public` fields on `MonoBehaviour` or `ScriptableObject` — also serialized.
- Fields with `[SerializeReference]` — polymorphic serialization.
- Fields with `[FormerlySerializedAs]` — migration metadata.

**Inspector-wired callbacks:**
- Public methods that match the signature for `UnityEvent` targets — likely wired in the inspector.
- Methods named to match `UnityEvent` fields on the same component.
- Public methods on components with public `UnityEvent` fields (the methods may be the wired-up targets).

**Engine lifecycle:**
- Unity message methods (`Awake`, `Start`, `OnEnable`, `OnDisable`, `OnDestroy`, `Update`, `FixedUpdate`, `LateUpdate`, `OnTriggerEnter`, `OnCollisionEnter`, `OnGUI`, `OnValidate`, `OnDrawGizmos`, `Reset`, `OnApplicationPause`, `OnApplicationFocus`, etc., and their 2D variants).
- These are case-sensitive and called by the engine, not by C# code.

**Dynamic invocation:**
- Methods invoked via `SendMessage`, `BroadcastMessage`, or `Invoke(name, …)`.
- Methods referenced by string name in animation events.
- Methods referenced by string name in `EditorApplication.delayCall` and similar editor hooks.
- Coroutines invoked via `StartCoroutine("MethodName")` (string overload).

**Editor integration:**
- Methods with `[MenuItem]`, `[InitializeOnLoadMethod]`, `[OnOpenAsset]`, `[CustomEditor]`, `[CustomPropertyDrawer]`, or similar editor attributes.
- Methods inside editor-only code that match Unity's editor extension signatures.

**Attribute-driven:**
- Any class with `[CustomEditor]`, `[CustomPropertyDrawer]`, `[CreateAssetMenu]`, `[ExecuteInEditMode]`, `[ExecuteAlways]`, `[RequireComponent]` — these may be invoked or instantiated by the engine, not by code.

**Networking / async:**
- Methods marked with networking attributes (`[Command]`, `[ClientRpc]`, `[ServerRpc]`, `[Rpc]`, vendor-specific networking attributes).

When in doubt — particularly with public methods on `MonoBehaviour` or anything that might be inspector-wired — **do not cull, ask the user**. The cost of leaving an unused element is minor; the cost of breaking inspector wiring is invisible until the user opens the editor and sees broken references.

## TODO format

For elements kept but not yet used:

```csharp
// TODO: <reason> — see Plan.md <step ID>
public void SwapItems(int sourceSlot, int destSlot)
{
    // ...
}
```

The reason should be brief and specific:
- `// TODO: Wired in S5 next iteration — see Plan.md S5`
- `// TODO: Interface contract from IInventoryClient — implementation pending S4`
- `// TODO: Public API introduced for external callers — see Plan.md "Out of scope" item 2`

Every TODO must reference a plan step or out-of-scope item, so the reviewer and user can verify the justification.

## Summary output requirements

The final summary must include two relevant sections:

**Culled** — Each removed dead element:
```
- Assets/Scripts/Player/PlayerController.cs :: private static readonly string LegacyPickupSound
- Assets/Scripts/Player/PlayerController.cs :: private void HandleLegacyInput
```

**Unused-but-required (TODOs)** — Each TODO'd kept element:
```
- Assets/Scripts/Inventory/InventoryService.cs :: SwapItems(int, int) — Plan.md S5
- Assets/Scripts/UI/InventoryView.cs :: OnInspectorSubmit() — Plan.md S6
```

The user must be able to grep `// TODO:` in the codebase and cross-reference with this summary list.

## What never happens

- No silent culling of public members that *might* be reflection-driven.
- No culling of code outside the changeset.
- No removal of `[SerializeField]` fields.
- No removal of Unity lifecycle methods, even if their bodies are empty.
- No automatic addition of `[Obsolete]` attributes as a soft cull — the choice is keep-with-TODO or cull, nothing in between.
