# Plan.md Format

The plan is the contract between the spec and the implementation. It needs to be readable by the implementer (who acts on it) and by the reviewer (who checks the code against it).

## Location

`<feature_folder>/Plan.md`. Prior versions are kept as `Plan.v1.md`, `Plan.v2.md`, etc. — see Phase 5 of the SKILL.md.

## Structure

Use this skeleton. Section names are fixed; the content fills in.

```markdown
# Plan: <feature_name>

**Outer iteration:** <N>
**Targets spec:** Spec.md (as of <short reference: section last edited, or "iteration N clarifications applied">)
**Previous version:** <Plan.v(N-1).md if exists, else "none — first iteration">

## Changes from previous iteration

<only present on iteration > 1>

<bullet list of what was added, removed, or modified relative to the previous plan, and why. Reference findings by ID when applicable.>

- Added step S4 to address finding F2 (null check on destroyed coroutine host).
- Removed step S6 from previous plan — turned out to be unnecessary once S3 was rewritten.
- Modified step S2 — now uses an event instead of a direct call per disputed-finding resolution.

## Spec coverage map

A table mapping every spec requirement to plan steps. The self-check verifies this is complete.

| Spec requirement | Plan steps |
|---|---|
| R1: <short label> | S1, S3 |
| R2: <short label> | S2 |
| R3: <short label> | S4, S5 |

(Steps not listed here are helpers — see "Helper steps" below.)

## Plan steps

Each step is concrete enough that the implementer can act on it without re-interpreting.

### S1: <short title>
**Covers:** R1
**Files:** Assets/Scripts/Inventory/InventoryService.cs (new)
**Description:** <one paragraph: what to do, mechanically>
**Rationale:** <if a non-obvious choice was made — e.g. "R1 says 'fast lookup'; chose Dictionary<int, Item> over List for O(1) access">

### S2: <short title>
**Covers:** R2
**Files:** Assets/Scripts/UI/InventoryView.cs (modify)
**Description:** <one paragraph>
**Rationale:** <if applicable>

...

## Helper steps

Steps that don't tie back to a specific spec requirement. Each must have a justification.

### H1: <short title>
**Justification:** Scaffolding for S3 — refactors the existing InputRouter to make room for the new inventory hotkey path.
**Files:** Assets/Scripts/Input/InputRouter.cs (modify)
**Description:** <one paragraph>

### H2: <short title>
**Justification:** <why this is needed even though no spec line names it>
**Files:** ...
**Description:** <one paragraph>

## Out of scope

Things explicitly NOT covered by this plan, but that someone might expect to be. Helps the reviewer avoid flagging deliberate omissions.

- <short bullet, e.g. "Item stacking — Spec.md R5 was clarified to apply only to consumables; equipment stacking is out of scope.">

## Acceptance criteria

How the reviewer can tell the plan was correctly implemented. One bullet per spec requirement.

- **R1 satisfied when:** <observable criterion, e.g. "InventoryService.GetItem returns the correct item for any registered id without iterating the full list">
- **R2 satisfied when:** ...
```

## Style notes

- **Concrete file paths, not abstract descriptions.** "Modify the inventory thing" is not actionable; "Modify Assets/Scripts/Inventory/InventoryService.cs" is.
- **One paragraph per step.** If a step needs more, it's probably two steps.
- **Rationale is for non-obvious decisions only.** Don't justify every step. Justify the ones where another engineer might reasonably ask "why this way?"
- **Reference spec requirements by their R-number consistently.** The coverage map and self-check depend on this.
- **Reference reviewer findings by their finding number** when amending the plan in iteration > 1. The reviewer skill outputs findings as "Finding 1", "Finding 2", etc. — use those identifiers.
- **No code in the plan.** The plan describes what to do; the implementer writes the code. An occasional method signature is fine if it's load-bearing for the design; full implementations are not.
