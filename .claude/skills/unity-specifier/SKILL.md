---
name: unity-specifier
description: Run a specification session with the user for a new Unity feature, producing a structured Spec.md and the feature folder structure that the unity-orchestrator skill expects. Use this skill whenever the user signals they want to start specifying a new feature — typical triggers include "I want to implement a new feature", "let's add", "I need a feature for", "we should build", "I want to spec out", "let's design", or any similar opening. The skill drives a question-and-answer session, probing for happy paths, negative paths, edge cases, and feature boundaries, then writes Spec.md and the feature folder so the orchestrator can pick up from there. Hand-off to the orchestrator is automatic on completion.
---

# Unity Specifier

A kickoff skill that drives the specification phase before implementation begins. It produces:

1. A feature folder next to `CLAUDE.md`, named for the feature.
2. A `Spec.md` inside that folder, structured so the planner can consume it directly (numbered requirements, happy paths, negative paths, edge cases, boundaries).

The specifier acts as a domain expert in good specification practice. It draws the user out through batched questions, fills gaps proactively, and ensures the spec is a "neat bundle of clear boundaries and to-be-done functions" before declaring done.

## When this skill runs

Triggers on the user's explicit signal to start specifying a feature. Examples:

- "I want to implement a new feature for the inventory system."
- "Let's add player saving."
- "I need a feature for difficulty scaling."
- "We should build a tutorial system."
- "I want to spec out the dialogue UI."

Does **not** trigger on casual mentions of features in passing ("the inventory's kind of slow"), questions about existing features ("how does the inventory work?"), or implementation-phase requests ("implement Spec.md"). The signal is the user starting a *new spec session*.

## Project-knowledge policy

Reading files costs tokens. Read only what's necessary to spec accurately.

In this priority order:

1. **What's already in this session's context.** If `CLAUDE.md` or other relevant files are already loaded, use that knowledge — don't re-read.
2. **The user's input.** The user is the primary source. If the feature seems standalone (no clear ties to existing systems), don't go file-hunting; just spec it from their description.
3. **Targeted reads of existing structure.** If the feature explicitly references an existing system ("add weights to the *inventory system*"), check that system's existing folder or main files. Read narrowly, not broadly.
4. **`conversation_search`** — only when the user references something Claude should know about but doesn't fully describe ("the thing we discussed last week", "like the system we built before"). Search by topic keywords; don't paste long passages.
5. **Never** read every file in the project. If you find yourself sweeping for context, stop and ask the user instead.

Default to *less* reading, more asking. The specifier's job is to draw clarity from the user, not to reverse-engineer it from the codebase.

## Procedure

Run these phases in order. Some can be revisited as the conversation surfaces new needs.

### Phase 1: Catch context

1. Read the user's opening prompt carefully. Identify:
   - The rough domain (inventory, AI, UI, save system, etc.).
   - Whether the feature appears to be **new**, an **extension** of something existing, or an **update** to something existing.
2. Check sibling directories of CLAUDE.md for existing feature folders with related names. If one looks like a match for what the user is describing:
   - Surface it to the user: "I see there's already an `InventorySystem` folder. Is this an extension of that, a new related feature, or something separate?"
   - If extension/update → propose a feature name that reflects the change. E.g. "add weights to inventory" → `UpdateInventorySystemWeights`, not `InventorySystem`.
   - If genuinely separate → confirm the name will be different so the orchestrator can disambiguate.
3. Apply the **CLAUDE.md Skill Behaviors** rules (see "Behavior overrides from CLAUDE.md" below) before continuing.

### Phase 2: Propose a feature name

Propose a filesystem-friendly PascalCase name based on the user's description.

Examples of naming patterns:
- New system: `InventorySystem`, `DialogueUI`, `SaveSystem`.
- Update to existing: `UpdateInventorySystemWeights`, `ExtendDialogueUIWithVoice`.
- Targeted fix or addition: `AddInventoryStacking`, `RefactorSaveLoadFlow`.

Show the user the proposed name and the path where the folder will live. Wait for confirmation or correction before creating anything. Do not create the folder yet.

### Phase 3: Elicit the core feature

Ask the user, in plain language, what the feature should do. The user's answer is the seed of the spec — get it in their own words first, before structuring.

Then identify the **discrete behaviors** the feature is supposed to support. These become the numbered requirements (R1, R2, ...) in the final spec. The planner depends on this numbering for its self-check.

If the user describes one behavior, ask whether there are others. If they describe many, group related ones together and confirm the grouping.

### Phase 4: Probe — happy paths

For each requirement, ensure at least one happy path is described:

- What's the normal flow when this works?
- What's the input or trigger? Who or what initiates it?
- What's the expected output or state change?

Ask in batches. Don't drip-feed questions one at a time.

### Phase 5: Probe — negative paths and edge cases

For each requirement, ensure the negative paths and edges are explored to a reasonable extent. These three framings are the floor:

1. **At least one negative path per happy path.** What happens if a precondition fails, input is invalid, or the trigger fires when it shouldn't?
2. **Boundary conditions.** What happens at limits — empty collections, max values, simultaneous operations, first frame, last frame, disabled GameObjects, mid-scene-load?
3. **External dependency failures.** What if the asset isn't found, the save is corrupted, a referenced component is null, the network is unavailable (if relevant)?

If the user doesn't volunteer these, ask proactively. Frame the questions as "I want to make sure we've thought about X" rather than "you forgot Y" — the user is the expert on the feature, the specifier is the expert on what specs need.

If the user says "that's not realistic" or "we'll never hit that case", capture that as an explicit assumption in the spec rather than dropping the case silently. The planner and reviewer will read that assumption and know not to over-engineer for it.

### Phase 6: Probe — boundaries

Ask the user explicitly: what is *not* part of this feature?

Common boundary questions:

- "Should this also handle X?" where X is adjacent functionality the user might assume is included.
- "Does this feature own Y, or just consume Y from elsewhere?"
- "When this is done, what should still be missing or done in a separate cycle?"

The goal is to prevent scope drift during implementation. Anything not in the spec is implicitly out of scope; making out-of-scope items *explicit* is much stronger.

### Phase 7: Draft the spec

Write the spec to a *draft location* first — do not commit to the feature folder yet. Use:

```
/tmp/spec-draft-<feature_name>.md
```

Follow the structure in `references/spec-format.md`.

### Phase 8: User review and sign-off

Show the draft to the user. Ask explicitly:

> "Does this Spec.md capture what you want? Anything to add, change, or remove? When you're happy, say 'looks good' or similar and I'll finalize the folder."

Iterate. The user may add requirements, remove them, change wording, or surface new edge cases. Update the draft in /tmp each round.

Do not finalize until the user signs off explicitly. "Sure" or "fine" or "go ahead" all count; ambiguous responses do not.

### Phase 9: Finalize

When the user signs off:

1. Create the feature folder next to `CLAUDE.md` with the agreed name.
2. Copy the draft spec into the folder as `Spec.md`.
3. Delete the /tmp draft.
4. Tell the user the folder is ready and what happens next:

```
Created <feature_name>/Spec.md. The orchestrator will kick in automatically the next time you ask to implement this feature (e.g. "let's implement <feature_name>" or "kick off the build"). Use "implement normally" or "without orchestration" if you'd rather skip orchestration for this one.
```

The specifier's job is done. The orchestrator handles everything from here.

## Behavior overrides from CLAUDE.md

This skill reads its subsection of `CLAUDE.md`'s "Skill Behaviors" section at the start of every session and applies the rules there as additional instructions on top of its normal procedure.

See `references/claude-md-behavior-section.md` for the section's structure and how the specifier reads it.

If the user gives feedback during a session that should become a standing rule ("I always want you to ask about save/load compatibility for any inventory feature"), do not silently absorb it. Ask whether to add it to the Specifier subsection of `CLAUDE.md`. If yes, propose the rule wording, show the diff, get user confirmation, then write.

## Reference files

- `references/spec-format.md` — the exact structure of `Spec.md`.
- `references/probing-checklist.md` — concrete prompts for happy/negative/edge/boundary probing.
- `references/claude-md-behavior-section.md` — how the Skill Behaviors section in CLAUDE.md works, what the Specifier subsection looks like, and how to propose updates to it.
