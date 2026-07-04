# Spec.md Format

The structure the planner depends on. Follow it strictly — the planner numbers requirements R1, R2, ... and checks plan coverage against them.

## Location

`<feature_folder>/Spec.md` once finalized.

## Structure

```markdown
# Spec: <feature_name>

**Created:** <ISO date>
**Status:** <"initial" on first creation; updated to "amended" if the planner amends it during clarification rounds>

## Overview

<2–5 sentences. Plain prose. What this feature is, why it exists, and the broad shape of what it does. Written so a new engineer joining the project can read this section and understand the feature's purpose without reading the rest.>

## Assumptions

<bullet list. Things the user has explicitly said are true or will not be considered. Capture user statements like "we'll never have more than 100 items" or "controller input is out of scope for v1" here. The planner and reviewer treat these as load-bearing.>

- <assumption 1>
- <assumption 2>

## Requirements

The numbered list the planner consumes. Each requirement is a discrete behavior the feature must support. Use the exact format below — the planner's self-check looks for the "R<N>:" pattern.

### R1: <short label>

**Description:** <one paragraph: what this requirement is, in implementation-agnostic terms. Avoid "use a Dictionary" or "fire an event"; those are planner/implementer decisions.>

**Happy path:**
<step-by-step or paragraph describing the normal flow. Trigger → behavior → outcome.>

**Negative paths:**
- <case 1>: <what happens>
- <case 2>: <what happens>

**Edge cases:**
- <case 1>: <expected behavior>
- <case 2>: <expected behavior>

**Acceptance:** <one short sentence stating how someone would know R1 is satisfied. The planner copies a version of this into Plan.md's acceptance criteria.>

### R2: <short label>

<same structure>

...

## Boundaries

What is **not** part of this feature. The planner treats anything not listed in Requirements as out of scope, but explicit non-goals here prevent ambiguity.

- <out-of-scope item 1, with a sentence on why or where it lives instead>
- <out-of-scope item 2>

## External dependencies

If the feature relies on external systems, list them. The planner uses this to know what NOT to design around.

- **<dependency name>:** <what the feature expects from it; what the feature should do if it fails>

(Omit this section entirely if there are no external dependencies.)

## Open questions

Anything the spec session ended without resolving. Each item should be resolvable by the user or the planner; if it's a true unknown that requires research, mark it as such.

- <question 1>
- <question 2>

(Omit this section if there are no open questions. A spec with open questions can still be handed to the planner, who will route them as clarifications, but a clean spec is better.)

## Clarifications

<populated by the planner during its Phase 2 clarification rounds, not by the specifier. The specifier leaves this section absent on first creation. The planner adds it if needed.>
```

## Style rules

- **Implementation-agnostic.** The spec describes *what* the feature does, not *how* it's implemented. Words to avoid: "Dictionary", "event", "MonoBehaviour", "ScriptableObject", "coroutine", specific class names. The planner picks the *how*.
- **Concrete enough to be testable.** Acceptance criteria should be observable. "Inventory works correctly" is not testable; "When an item is added to a full inventory, the add operation returns false and no slot is modified" is.
- **One requirement per R-number.** If a requirement description contains the word "and" connecting two distinct behaviors, consider whether they should be R1 and R2 instead.
- **Negative paths are real requirements, not edge cases.** A negative path describes intentional behavior in a failure case ("if the save file is corrupt, show the corruption error and offer to start a new game"). An edge case describes behavior at a boundary ("with an empty inventory, the UI shows the empty state graphic"). Both matter; both belong in the spec.
- **No code.** No code samples, no method signatures, no architectural sketches. The planner and implementer handle those.

## What the spec is NOT

- It's not a design document. Design choices (which patterns, which classes, which files) live in Plan.md.
- It's not a backlog. One feature per Spec.md. If the user describes three features, run three spec sessions (or be very clear that this is one feature with three sub-behaviors as separate requirements).
- It's not permanent. The planner may amend the spec during clarification rounds. The version on disk is always the current state.
