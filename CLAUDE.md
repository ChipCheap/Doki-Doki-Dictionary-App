## Project Context

TypeScript Progressive Web App for vocabulary learning with spaced repetition (Anki / renshuu.org-style). Storage: IndexedDB via Dexie.js. UI framework: TBD by planner (React / Svelte / Vanilla all acceptable). Build: a modern bundler appropriate for PWAs. Offline-capable after first load. No backend, no accounts — portability between machines is achieved via in-app JSON export/import.

Initial target languages: Spanish and Vietnamese. Base language for v1: English. Scheduling algorithm: SM-2 with a custom lapse policy (see active feature spec for details).

## General Behavior
You are a coding assistant tasked with designing expansible code structures and answering design choice questions.
When responding to any questions or make decisions, make sure to inform yourself and provide the used resources as basis
for your answers. Respond in a way that clearly shows reasons and root causes and the resulting decisions from it. 
Whenever you are unsure, do not backtrack much, unless you find concrete reasons against your decision, 
simply commit to one decision and reason it properly. If the decision turns out
to be suboptimal, it is always possible to undo changes later.

Make sure that any questions that would still be open are answered for you. Do not assume or make up anything and ask the user instead.

## Coding guidelines
Lambda parameter names — and all local variable names — must be full descriptive words, not abbreviations.
e.g. `UnitList.Where(unit => unit.currentHealth > 5)` not `UnitList.Where(u => u.currentHealth > 5)`.
Avoid abbreviations like `ru`, `kvp`, `sb`, `rt`, `grp`. Spell them out: `resourceUnit`, `keyValuePair`, `stringBuilder`, `rectTransform`, `group`.

Always use curly brackets for if, for, while, and foreach statements, even for single-line bodies.

Add XML documentation (`/// <summary>`) to all public methods and classes. Fields do not need documentation unless their purpose is not obvious from the name.

Verification sections can be left out of plans. Testing will be done in bulk later.

### Dictionary access
Prefer `dictionary.GetValueOrDefault(key)` over `dictionary.TryGetValue(key, out var value)` for read-only lookups. Pass an explicit default as the second argument when needed.
Before adding a null check on a dictionary value, verify that null is actually possible. For `Storage.resourceTypeToResourceUnitMap`, every `ResourceType` is pre-populated with a non-null `ResourceUnit` in `Storage.InitializeAllResources()` — direct indexing (`storage.resourceTypeToResourceUnitMap[resourceType]`) is always safe and no null check is needed.

### Inspector-assigned fields
Never add null checks for `[SerializeField]` or public fields assigned in the Unity Inspector (panels, buttons, transforms, etc.).
If a field is not assigned, the resulting `NullReferenceException` is intentional — it surfaces the missing assignment immediately.
Do not add null-guards, early returns, or `?` null-conditional operators on these fields.

### Caravan hostility checks
Hostility between Caravans is resolved through `Caravan.IsConsideredFriendly(Caravan other)`, which delegates to `mapAI.IsConsideredFriendly` when a `CaravanMapAI` is attached and falls back to the default origin/locationType check otherwise. Never compare `origin` or `locationType` directly for hostility — always go through `IsConsideredFriendly` so map-AI overrides (per-camp friendliness, per-species packs) keep working.

### WorldLocation naming
All concrete or abstract subclasses of `WorldLocation` end in `Location` (e.g. `UrbanLocation`, `NaturalLocation`, `BanditCampLocation`, `MonsterLairLocation`). When adding a new location type, follow this suffix.

### Caravan navigation contract
A Caravan's destination is set exclusively through `setter.target = transform; ai.SearchPath();`. Do not write to `ai.destination` directly. `mapAI.CurrentDestination` is the single source of truth when non-null; when null, mission logic in `Caravan.Movement.FindNextTarget` is the fallback. New movement-controlling code must follow this contract — never bypass `setter.target` so threat awareness (`ThreatSensor.isTargetingMe` reads `other.NavigationTarget`) keeps working.

### Camp population convention
Camp-type WorldLocations (`BanditCampLocation`, `MonsterLairLocation`) do not maintain a separate `population` value. Their inhabitants are exclusively the units in `garrisonUnits`; dispatches mutate that list directly, and `currentGarrison` reflects the live count. If a future camp type needs a separate civilian population, add it explicitly rather than assuming parity with `UrbanLocation`.


## Open Architectural Questions
These are deferred design decisions to revisit when the surrounding system is touched. Do not silently work around them — flag them in plans that intersect with the listed area.

### Storage food/material capacity split
`Storage` currently has separate `maximumFoodCapacity` and `maximumMaterialCapacity` (with matching `currentFoodCarry` / `currentMaterialCarry`). The split exists primarily to support different spoilage rates between food and non-food resources. It feels too rigid in practice — a horde can be "full of food" while material capacity sits empty, and vice versa.

A future revision should reconsider:
- Whether to merge into a single weight cap with spoilage tracked per-resource instead of per-bucket
- How `Storage.CalculateFoodResourceStorage` / `CalculateMaterialResourceStorage` and `IStoringEntity.WouldExceedCapacity` would change
- Cart capacity contributions (currently stacked onto both buckets in `PlayerCaravan.UpdateCaravanStats`) would simplify to a single sum

Until the revision happens, new features should keep adding to both buckets equally (as cart capacity does today) rather than picking a side.
