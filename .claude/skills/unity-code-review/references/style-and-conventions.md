# Style, Conventions, Readability, Maintainability

The point of this pass is **not** to catch formatting nits — leave those to a linter or formatter. The point is to catch style/convention violations that will cost a human reviewer time later.

## How CLAUDE.md interacts with this pass

CLAUDE.md is **additive**, not authoritative. Run the generic Unity/C# conventions checklist below first, *then* layer CLAUDE.md rules on top as additional requirements. Both can produce findings independently.

- A generic-convention violation is a finding even if CLAUDE.md is silent on it.
- A CLAUDE.md violation is a finding even if the generic conventions would allow it.
- If the two conflict on the same piece of code, mention both in the root cause and recommend following CLAUDE.md in the suggested fix (the project's explicit choice wins for the fix, but the user should see that a generic convention is being deliberately overridden).

## CLAUDE.md rules to apply

Read `CLAUDE.md` at the start of the review. Common things it may codify:

- Naming conventions (PascalCase, camelCase, `_underscorePrefix`, `m_` prefix, etc.).
- File organization (one type per file, namespace layout, folder structure).
- Architectural rules ("no singletons", "no Resources.Load", "all serialized fields private").
- Forbidden APIs or patterns.
- Required documentation style.

Any violation of CLAUDE.md is a finding. Use the file's wording in the "root cause" so the next plan can quote it back.

## Generic C# / Unity conventions

These apply regardless of what CLAUDE.md says:

- Public mutable fields where a property or `[SerializeField] private` would be appropriate.
- Methods doing too many things — a method whose name has "and" in it, or whose body has multiple distinct concerns.
- Magic numbers (especially in physics, input thresholds, timing) without a named constant.
- String literals used as identifiers (tags, layer names, animator parameters) without a constants class.
- Deeply nested conditionals (more than 3 levels) where early returns or guard clauses would flatten the code.
- Duplicated logic across multiple files that should be factored.
- Dead code, commented-out blocks, unused private members.
- TODOs without an owner or ticket reference.

## Readability heuristics

- Variable names that don't convey intent (`tmp`, `data`, `obj`, `x`, `flag`).
- Boolean parameters that read ambiguously at the call site (`DoThing(true, false)`) — consider an enum or named arg.
- Inverted booleans (`isNotReady`) that double-negate at use sites.
- Comments explaining *what* the code does (redundant) vs *why* (useful) — flag the former as noise if it dominates.
- Methods longer than ~50 lines that could split cleanly.

## Plan-correspondence note

If the plan said "rename X to Y for clarity" and the code did the rename but left `X` mentioned in comments or strings, flag it here — partial renames are a maintenance trap.
