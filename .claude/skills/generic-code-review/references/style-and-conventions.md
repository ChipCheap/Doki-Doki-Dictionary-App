# Style, Conventions, Readability, Maintainability

The point of this pass is **not** to catch formatting nits — leave those to a linter or formatter. The point is to catch style/convention violations that will cost a human reviewer time later.

## How CLAUDE.md interacts with this pass

CLAUDE.md is **additive**, not authoritative. Run the generic conventions checklist below first (in light of the project's language from `## Project Context`), *then* layer CLAUDE.md rules on top as additional requirements. Both can produce findings independently.

- A generic-convention violation is a finding even if CLAUDE.md is silent on it.
- A CLAUDE.md violation is a finding even if the generic conventions would allow it.
- If the two conflict on the same piece of code, mention both in the root cause and recommend following CLAUDE.md in the suggested fix.

## CLAUDE.md rules to apply

Read `CLAUDE.md` at the start of the review. Common things it may codify:

- Naming conventions (PascalCase, camelCase, snake_case, prefix conventions).
- File organization (one type per file, module layout, folder structure).
- Architectural rules ("no global state", "no service locators", "dependency injection only").
- Forbidden APIs or patterns.
- Required documentation style.

Any violation of CLAUDE.md is a finding. Use the file's wording in the "root cause" so the next plan can quote it back.

## Generic conventions

These apply regardless of what CLAUDE.md says, calibrated to the project's language:

- **Public mutable fields** where an accessor (getter/setter, property, or read-only field) would be more appropriate.
- **Methods doing too many things** — a method whose name has "and" in it, or whose body has multiple distinct concerns.
- **Magic numbers** (especially in business logic, timing, thresholds) without a named constant.
- **String literals used as identifiers** (tags, route names, event types, config keys) without a constants module.
- **Deeply nested conditionals** (more than 3 levels) where early returns or guard clauses would flatten the code.
- **Duplicated logic** across multiple files that should be factored.
- **Dead code, commented-out blocks, unused private members** within the changeset.
- **TODOs without an owner or ticket reference.**

## Language-specific style

Apply idiomatic style for the project's language. The principles are universal but the surface differs:

- **Python:** PEP 8 naming, type hints where the project uses them, idiomatic use of comprehensions and context managers.
- **TypeScript / JavaScript:** consistent module style (CommonJS vs ESM), TypeScript strictness honored, no unnecessary `any`.
- **Java / Kotlin:** appropriate use of immutability (`final` / `val`), consistent use of nullable types, idiomatic stream operations.
- **Go:** error handling conventions, `gofmt` compliance, idiomatic interface use.
- **Rust:** idiomatic error handling (`?` operator, `Result`), borrow vs owned where appropriate, `clippy`-flagged patterns.
- **C# / .NET:** idiomatic LINQ, async/await patterns, nullable reference types where enabled.

These are examples; apply the language's own community conventions when none of the above match.

## Readability heuristics

- Variable names that don't convey intent (`tmp`, `data`, `obj`, `x`, `flag`).
- Boolean parameters that read ambiguously at the call site (`DoThing(true, false)`) — consider an enum, options object, or named arguments.
- Inverted booleans (`isNotReady`) that double-negate at use sites.
- Comments explaining *what* the code does (redundant) vs *why* (useful) — flag the former as noise if it dominates.
- Methods longer than ~50 lines that could split cleanly.

## Plan-correspondence note

If the plan said "rename X to Y for clarity" and the code did the rename but left `X` mentioned in comments, strings, or documentation, flag it here — partial renames are a maintenance trap.
