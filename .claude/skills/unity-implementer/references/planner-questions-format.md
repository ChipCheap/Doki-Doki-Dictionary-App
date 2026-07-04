# PlannerQuestions.md Format

When the implementer hits a question that's about *what* to implement (rather than *how*), or a plan step that turns out to be wrong/impossible, the implementer writes `PlannerQuestions.md` in the feature folder. The orchestrator spawns the planner for one resolution round; if any question remains unresolved after that round, the user is escalated.

This file is ephemeral — delete it once the planner has responded and the implementer has accepted the resolution.

## When to use this file

Route to the planner when the question is about design intent, scope, or what the plan should say. Examples that belong here:

- "Plan step S3 says fire an event when inventory updates — does 'update' mean only add, only remove, or both?"
- "S5 calls for a save system, but Spec.md doesn't say which fields persist. The plan also doesn't list them. What should be saved?"
- "S4 says implement this as a singleton, but CLAUDE.md forbids singletons. Is the plan wrong, or should I propose an alternative?"
- "S2 says modify `InventoryView` but `InventoryView` doesn't exist in the codebase. Is this a missing earlier step, a rename, or a typo?"

Do **not** route to the planner for:

- Technical implementation choices the user can answer (which event system, where to cache, struct vs class). Those go to the user directly.
- Bug analysis (reviewer's job).
- Style preferences (CLAUDE.md authoritative; if CLAUDE.md is silent, follow generic Unity convention).

## Format

```markdown
# Planner Questions: <feature_name>

**Outer iteration:** <N>
**Plan version under discussion:** Plan.md (current)
**Created by:** implementer
**Trigger phase:** <Phase 2 | Phase 4 | Phase 5>

## Question 1

**Plan reference:** <step ID, e.g. S3>
**Plan text (verbatim):**
> <quote the relevant line(s) from Plan.md>

**Why this is a planner question, not a technical one:**
<1–2 sentences. State why the implementer cannot answer this without knowing design intent or scope.>

**What the implementer needs to know:**
<the concrete question, phrased so the planner can answer it directly>

**If applicable — candidate answers:**
<list 2–3 interpretations the planner can pick from, or "no candidates — please specify">

## Question 2

<same structure>

...

## Implementation status

<one of:>
- "Implementation is paused pending these answers. Nothing has been written for the affected steps."
- "Implementation is partially complete. Steps S1, S2 are done; the questions above block S3 and S5."
- "Implementation is complete except for the items above, which need plan revision before they can be done."
```

## After the planner responds

The planner's response per question will look like one of:

- **Answer in place** — the planner provides the answer and amends Plan.md (likely with a Technical note or a step-text edit). The implementer reads the updated plan and proceeds.
- **Plan revision** — the planner rewrites a step or the surrounding section. The implementer reads the revision and proceeds.
- **Escalate to user** — the planner cannot answer without spec/user input. The orchestrator routes to the user.

The implementer does **not** get a second round to push back on the planner's answer. One round, then accept or escalate.

## Cleanup

When the round is complete:

1. If all questions were resolved (planner answered or plan revised), delete `PlannerQuestions.md`.
2. If any were escalated to the user, leave the file in place until the user has decided; then delete it.

The file must not survive into the next outer iteration. A stale planner-questions file would confuse future runs.
