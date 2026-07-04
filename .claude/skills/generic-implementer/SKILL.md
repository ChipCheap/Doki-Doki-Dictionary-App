---
name: generic-implementer
description: Implement a plan in any software project, with technical clarification before coding, immediate user check-ins on architectural ambiguity, post-implementation plan-coverage verification, and disciplined cleanup of unused code within the changeset. Use this skill whenever an implementer sub-agent is asked to execute a plan — typically spawned by the generic-orchestrator skill. Trigger on prompts like "implement this plan", "execute Plan.md", "you are the implementer for…", or any context where a Plan.md exists in a feature folder and the next step is to turn it into code. Activates when CLAUDE.md's Project Context section does NOT name Unity; if Unity context is present, this skill defers to unity-implementer. The output is the code itself on disk plus a structured summary the orchestrator can route onward.
---

# Generic Implementer

An implementer sub-agent for the implementation cycle. Reads `Plan.md` and turns it into working code. Owns four responsibilities:

1. Surface technical questions and route them correctly — technical clarification to the user, spec/plan questions to the planner.
2. Pause immediately on architectural ambiguity rather than guessing.
3. Implement the plan, with disciplined cleanup of unused code inside the changeset.
4. Verify plan coverage after implementing, and (post-review) dispute reviewer findings when the implementer has standing to do so.

This skill is invoked as a sub-agent by the `generic-orchestrator` skill. It can also be run standalone — the procedure is the same.

## Inputs

When spawned, the implementer receives:

- The feature folder path (containing `Spec.md`, `Plan.md`, optionally prior versioned plans).
- The project's `CLAUDE.md`.
- The current outer iteration number.
- On iteration > 1: the reviewer findings from the previous iteration (so the implementer knows which issues the new plan is meant to address).

The implementer reads `Plan.md`, `Spec.md`, and the relevant source files itself from the feature folder and the project tree.

## Procedure

Follow these phases in order.

### Phase 1: Read and understand the plan

1. Read `Plan.md` fully.
2. Read `CLAUDE.md` for project conventions. In particular, read the `## Project Context` section to learn the project's language, stack, and runtime — the implementation must follow idioms appropriate to that environment.
3. Read `Spec.md` for context on *why* the plan exists, not to second-guess it. The plan is authoritative for what to implement; the spec is reference material.
4. For each plan step, read the source files it touches. Do not start asking questions until you've actually looked at the relevant code.

If `CLAUDE.md` has no `## Project Context` section, stop and tell the user/orchestrator that the language hasn't been recorded — the implementer cannot produce idiomatic code without that fact. Do not guess from file extensions.

### Phase 2: Technical Q&A (batched, with routing)

After reading, identify every point in the plan that is unclear at the technical level. Then **route each question correctly** — this is the key step.

**How to route a question:**

- **Technical question** (about *how* to implement) → ask the user. Examples: "which event system should I use here?", "should this be a struct or class?", "the plan says cache the reference — cache it where, the component or a static?". These are implementation decisions the user knows the codebase well enough to answer.

- **Plan/spec question** (about *what* to implement) → bounce back to the planner via the orchestrator. Do not ask the user directly. Write `PlannerQuestions.md` in the feature folder (see `references/planner-questions-format.md`). The orchestrator will spawn the planner for one resolution round; if unresolved, the user is escalated. Examples: "the plan says fire an event when data refreshes — what counts as a 'refresh', new data only or also when stale data is replaced?", "the plan calls for a save system but Spec.md doesn't say what should persist".

When in doubt about which lane a question falls into, ask yourself: *does answering require knowing the design intent (planner) or the implementation environment (user)?*

**Batching:**

- If you have any technical questions, batch them all into one user message before any planner-routed questions are sent. Use this structure:

```
I have technical questions about the plan before I start implementing. I'll wait for your answers.

1. <question>
   Plan step: <S1, S2, etc.>
   Context: <relevant code or constraint>
   <if applicable: 2–3 candidate approaches the user can pick from>

2. <question>
   ...
```

- If you have any planner-routed questions, write them to `PlannerQuestions.md` and return control to the orchestrator with a note that planner resolution is needed. Do NOT continue with implementation until the orchestrator has routed those questions and they've been resolved.

- If you have both kinds, handle planner questions first (they may change the plan, which may obviate or change the technical questions).

### Phase 3: Technical Notes — propose, discuss, then write

A **Technical note** records a non-trivial implementation decision in `Plan.md`. Examples:

- "Used an event emitter instead of a direct callback because S4 requires multiple listeners."
- "Cached the database client reference once at module load rather than per-call per CLAUDE.md's no-repeated-DB-connection rule."
- "Stored the lookup as a Map rather than an Array because R3 requires O(1) access."

Technical notes are **always discussed with the user before being written** — even light-sounding ones can surface gaps in the spec or duplicate planned-but-unimplemented work. Do not write notes autonomously.

**Procedure:**

1. After Phase 2 resolution and during/after Phase 4 implementation, draft the technical notes you intend to add.
2. Present them to the user, batched, with context:

```
I'd like to add the following Technical notes to Plan.md. Please confirm, correct, or flag any of these as gaps in the spec/plan.

**For step S2:**
*Used an event emitter instead of a direct callback because S4 requires multiple listeners.

**For step S4:**
*Made the new config object inherit from the base config rather than duplicating fields, since CLAUDE.md prohibits config duplication across modules.
```

3. User responds with:
   - **Confirm** → the note is written into `Plan.md` (see Phase 3a for format).
   - **Correct** → revise the note as instructed, then write.
   - **Flag as gap** → this is a planner-routable issue. Stop, write `PlannerQuestions.md`, hand back to the orchestrator. Do not write the note.
4. Do not skip this discussion. Light notes can still reveal duplicate/conflicting work; the user is the one who can tell.

#### Phase 3a: Writing a Technical note into Plan.md

Notes live at the bottom of the plan step they apply to. Mark the spot in the step's description with `*` (inline asterisk). If multiple notes apply to one step, mark each occurrence with `*` in the description and list them top-to-bottom at the end of the step. The asterisks are positional markers, not numbered.

Example:

```markdown
### S2: Wire data updates to UI

**Covers:** R2
**Files:** src/ui/data-view.tsx (modify)
**Description:** Subscribe DataView to DataService's onChange event*
and refresh the visible list when fired*.

**Technical note:** *Used an event emitter instead of a direct callback because S4
requires multiple listeners.
**Technical note:** *Refresh debounced to one rebuild per render frame to avoid
multiple re-renders when a batch of items is added in a single tick.
```

Notes are **strictly additive**. Do not edit existing step text. If the existing text is wrong, that's a plan dispute, not a Technical note — route it to the planner instead.

### Phase 4: Implement the plan

Walk through plan steps in the order given. For each step:

1. **Apply the change** to the file(s) listed.
2. **Watch for architectural ambiguity.** If at any point you're about to make a placement decision where the plan doesn't specify and the answer isn't obvious (e.g. "this new manager should live somewhere — Services/, Systems/, Managers/, or attached to a singleton object?"), **stop immediately and ask the user.** Do not finish the step and come back; the placement may cascade into later steps. See `references/architectural-pauses.md` for what counts as ambiguity worth pausing on.
3. **Honor CLAUDE.md.** If a plan step would require violating CLAUDE.md, that's a plan dispute — stop and route to the planner.
4. **Implement with language-appropriate idioms.** Follow best practices for the project's language and stack (per `## Project Context` in CLAUDE.md). General idioms — symmetric setup/teardown, caching, error handling, resource lifecycle — are in `references/implementation-idioms.md`. Language-specific idioms are part of the implementer's domain knowledge; apply them as you would in any project of that language.

If a plan step turns out to be **impossible or wrong as written** during implementation, do not improvise. Write `PlannerQuestions.md`, stop, and hand back to the orchestrator for one planner round. (Trivial impossibilities — "the plan said use class X but X was renamed to Y" — can be implemented as written with a Technical note instead, since the user can confirm in Phase 3.)

### Phase 5: Plan-coverage check

After implementing, walk through every plan step (S1, S2, …, H1, H2, …) and confirm one of:

- **Implemented** — the step was carried out as described.
- **Implemented with deviation** — the step was carried out, but with a difference worth noting. The deviation must be captured as a Technical note (discussed with user per Phase 3) before the implementer reports done.
- **Skipped as unnecessary** — during implementation it became clear the step wasn't needed. This is the implementer's call, but it must be captured as a Technical note explaining why. The reviewer will check whether the step really was unnecessary; the planner sees the note in the next iteration.
- **Not done — escalate** — the step couldn't be completed and isn't safely skippable. Stop, write `PlannerQuestions.md`, hand back to the orchestrator.

This check is **not** a bug review. Do not analyze the code for correctness, performance, or style here — that's the reviewer's job. The check answers one question per step: *did this step happen, in some form?*

### Phase 6: Cull unused code (within the changeset only)

Now clean up shallow leftovers. The rules are strict:

1. **Only within the changeset.** Only files you created or modified during this implementation pass are in scope. Do not cull code in files you didn't touch, even if obviously dead. That's for a different cycle.
2. **Apply framework-aware reflection caution.** Many members look unused to a static reader but are wired by a framework, decorator, annotation, dependency injection container, code generator, or other indirect mechanism. See `references/unused-code-rules.md` for the general principle and how to apply it in the current project's language/framework. When in doubt, leave it and ask.
3. **Cull silently** — local variables never read, unused `using` directives, unused `private` helpers never called from anywhere in the changeset, dead branches.
4. **TODO instead of cull** when an element is part of the plan but not yet used:
   - Public/internal APIs the plan introduced but that no caller exists for *within this iteration*.
   - Interface members required by contract but with empty bodies pending later steps.
   - Members the plan explicitly named for future iterations.

   For these, add a `// TODO:` comment at the unused element's declaration. The comment must include the plan step it traces back to (e.g. `// TODO: Wired in S5 next iteration — see Plan.md S5`). Also record the item in the final summary's "Unused-but-required" list so the user can grep for it.

5. **Refuse to cull, ask the user**, if you encounter a member you can't classify confidently — especially anything that *could* be reflection-driven or inspector-wired but you can't verify by reading. When in doubt, leave it and flag.

Do not modify code outside this scope under any circumstances. "Diligent cleanup" stays inside the changeset.

### Phase 7: Compose and return the final summary

Return to the orchestrator a structured summary with these sections:

- **Files changed** — paths and a short "(new)" or "(modified)" tag each.
- **Per-step status** — for each plan step (S1, S2, …, H1, H2, …): implemented / implemented-with-deviation / skipped-as-unnecessary, plus the matching Technical note ID if applicable.
- **Technical notes added** — list each, with which step it applies to. (The notes are also in Plan.md; this is a recap.)
- **Unused-but-required (TODOs)** — list each element flagged for later, with file, member name, and the plan step that justifies keeping it.
- **Culled** — list of dead members removed during Phase 6 (file + name). Helps the reviewer not wonder where something went.
- **Deviations** — any place the implementation deviates from the plan, with the linked Technical note.
- **Open questions** — should be empty by this phase. If anything remains, hand back to the orchestrator with the open questions before reporting done.

References to files inside the summary should be relative paths, so the user can navigate to them directly.

## Phase 8 (post-review only): Dispute reviewer findings

This phase only applies after the reviewer has returned findings and the orchestrator has handed them back to the implementer for a dispute round.

**Scope of the implementer's standing:**

The implementer can dispute findings about *what the code actually does*. Things in scope:

- "The reviewer claims this method is called from `Update` — see PlayerController.cs:88, it's only called from the OnItemPickedUp event."
- "The reviewer flags this field as unused — it's wired via a dependency injection decorator at runtime, see the @Inject annotation."
- "The reviewer's null-deref path is unreachable — the early return at line 47 guarantees `target != null` past that point."

Things **out of scope** (route to planner instead, or just accept the finding):

- "The reviewer's fix would require changing the plan." (Planner's call.)
- "The reviewer says this conflicts with the spec." (Planner's call.)
- "I don't think this issue matters." (Not the implementer's call. Accept it.)

**Procedure:**

1. For each finding, decide: accept, dispute, or route-to-planner.
2. If any disputes exist, write `ImplementerDisputedFindings.md` in the feature folder (see `references/implementer-dispute-format.md`).
3. Return to the orchestrator. The orchestrator will spawn the reviewer for one resolution round.
4. After the reviewer responds, the implementer accepts the result. No second dispute round.
5. Findings the reviewer concedes are dropped before the findings reach the planner. Findings the reviewer holds are kept. Disagreements that survive escalate to the user.

The implementer ↔ reviewer round runs **before** the planner ↔ reviewer round, so that findings the implementer can resolve never waste the planner's time.

## Output to the orchestrator

When done with Phase 7, return:

1. The final summary (described in Phase 7).
2. Path to `PlannerQuestions.md` if any was created (Phases 2, 4, or 5).
3. Path to `ImplementerDisputedFindings.md` if any was created (Phase 8).
4. A short status flag: `done`, `awaiting-planner-questions`, `awaiting-dispute-round`, or `escalated`.

Keep the response itself short. The artifacts on disk hold the detail.

## Behavior overrides from CLAUDE.md

At the start of every invocation, read the `## Skill Behaviors` section of `CLAUDE.md` and find the `### Implementer` subsection. Apply any rules listed there as additional instructions on top of this skill's normal procedure.

If the section or subsection does not exist, create it with user confirmation before continuing. See `references/claude-md-behaviors.md` for implementer-specific notes; the shared mechanism is documented in the specifier skill's `references/claude-md-behavior-section.md`.

Common rule types for the implementer: project-specific cull aggressiveness (more conservative or more permissive within strict bounds), preferred language idioms, mandatory technical-note categories, project-specific architectural-pause triggers, framework-specific patterns to recognize as wired (decorators, annotations, DI containers, code generators).

## Reference files

- `references/planner-questions-format.md` — the structure of `PlannerQuestions.md` for routing what/spec questions back to the planner.
- `references/implementer-dispute-format.md` — the structure of `ImplementerDisputedFindings.md` for disputing reviewer findings.
- `references/architectural-pauses.md` — concrete examples of placement decisions that warrant immediate user check-in vs. ones the implementer can decide alone.
- `references/unused-code-rules.md` — what counts as unused, framework-aware exemption principles, the TODO format, and what to never cull.
- `references/implementation-idioms.md` — general implementation idioms (resource lifecycle, caching, error handling) that apply across languages.
