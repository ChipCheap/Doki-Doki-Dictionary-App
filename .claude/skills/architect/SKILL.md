---
name: architect
description: Derive a feasible code architecture from the explorer's design frameworks, before feature specification. Produces an architecture.md next to CLAUDE.md — standing design guidelines for future code (extensibility, separation, cohesion, understandability) plus infrastructure decisions (databases, caching, messaging, hosting). Every architectural choice is presented as a suggestion with its reasons and its drawbacks; the user decides. Supports a project-wide architecture.md plus optional feature-level architecture files (one per feature), and keeps them consistent with each other and the frameworks. Use this skill when the user signals they want to shape the system's architecture — triggers include "let's design the architecture", "set up the code architecture", "how should this system be structured", "decide the infrastructure", "what database should we use". This skill stays at the guideline level and does NOT make class-, method-, or library-level decisions — those belong to the implementer.
---

## Always: read and respect CLAUDE.md

At the **start of every run**, read `CLAUDE.md` fresh from disk. Do not
rely on memory, a session summary, or an earlier read — it may hold coding
guidelines, behavioral rules, or project conventions that changed
mid-project, and those changes are easy to miss otherwise.

Treat everything in it as **additive** to this skill: its rules apply on
top of the skill's own instructions, they don't replace them. Honor its
coding and behavioral guidelines in everything this skill produces.

If a CLAUDE.md rule appears to **directly conflict** with a skill
instruction, do not silently pick one — surface the conflict to the user
and let them choose. Re-read CLAUDE.md if the session runs long or the user
mentions changing project rules.

# Architect

This skill sits between exploration and specification:

explore → architect → specify → plan → implement → review


Its job is to turn the design frameworks the explorer produced into a **feasible code architecture**: the standing guidelines future code should follow, and the infrastructure decisions the project rests on. It answers "how should this system be shaped so the designs are buildable, expansible, well-separated, cohesive, and understandable?" — and it answers by *proposing*, not deciding.

It produces `architecture.md` next to `CLAUDE.md`. The specifier, planner, implementer, and reviewer all read it and are expected to respect it, the same way they respect the framework files.

**Two firm boundaries on this skill:**

- **Everything is a suggestion; the user decides.** For every architectural choice, present the realistic options, each with **why** it fits and **what drawbacks** it brings, give a recommendation, and let the user pick. Never decide an architecture unilaterally, and never present one path as the only path when alternatives exist.
- **Stay at the guideline level.** The architect sets guardrails — layers, module boundaries, data-flow direction, extensibility strategy, infrastructure choices, standing design rules. It does **not** choose classes, methods, specific libraries or versions, or algorithms. Those are the implementer's job. If you find yourself specifying a class or a function signature, stop — that belongs downstream.

## Framework inputs (read first)

Before anything else, read the design frameworks next to `CLAUDE.md`. They are the input this architecture must serve. Frameworks are the explorer's output; if the project skipped exploration and neither file exists, you can still architect from the user's description, but say so and lean harder on questions.

1. **`framework.md` (project-wide).** The project's goals, rules, and invariants. The architecture must **serve these goals** and must never make a project invariant impossible to uphold.
2. **`<Feature>.framework.md` (feature-level).** Any feature designs already explored. These reveal the structural demands on the system — persistence, real-time behavior, multiplayer, scale, extensibility pressure points.

Derive the architecture's requirements *from* these: what the designs imply about data, state, boundaries, and infrastructure. When a framework leaves an architectural question open (its `## Open Questions`), that's a decision for this skill to surface.

**Reconcile.** The architecture must not break a framework invariant. If serving the design cleanly seems to require violating one, surface it and let the user choose: change the architecture, or consciously amend the framework. Never resolve it silently.

## Routing: tailor to the project type

Read `CLAUDE.md`'s `## Project Context` (and check for an `Assets/`/`ProjectSettings/` folder or `.unity` files). This does not change the process — it changes which **standard designs** you propose:

- **Unity / game:** component composition vs inheritance, MonoBehaviour vs plain-C# boundaries, ScriptableObject-driven data and config, scene/prefab structure, assembly-definition boundaries, ECS/DOTS where warranted, event/messaging between systems, save/load architecture, service-locator vs dependency-injection for cross-system access.
- **App / service / generic:** layering (e.g. layered, hexagonal/ports-and-adapters, vertical-slice, clean), module and bounded-context boundaries, dependency direction, API surface shape, persistence and data-access strategy, caching, messaging/eventing, sync vs async boundaries, deployment shape.

If there is no `## Project Context` yet, ask the user what the project is (game/app/service) and its language/stack, and — if this is genuinely the first skill to run — offer to record it (confirm before writing). Downstream skills route on this.

## Existing architecture (check before creating)

If `architecture.md` (or a matching `<Feature>.architecture.md`) already exists, **don't overwrite it** — read it and offer to refine or extend it. Treat prior decisions as settled unless the user reopens them; new work layers on top.

## How to architect

Work through the architecture as a series of **decisions**, grouped by area, presented in focused batches. Don't dump every decision at once, and don't drip them one at a time — group the ones that interact (e.g. persistence + data-access + caching belong together).

For **every** decision:

1. State the decision to be made and why it arises from the framework.
2. Give the realistic options — usually recognized **standard designs**, not bespoke inventions.
3. For each option, give **why** (what it's good for, how it fits the designs and the quality goals) and **drawbacks** (what it costs, what it makes harder, what it locks in).
4. Give a **recommendation** with your reasoning.
5. Hand the choice to the user. Record what they pick; if they defer, park it under Open Questions with your recommended default and its tradeoffs.

Optimize for four quality goals, and name the tensions between them rather than pretending they don't exist (more separation can cost immediate understandability; more extensibility can cost simplicity):

- **Expansible (bounded)** — the architecture accommodates everything the *fully-explored framework* calls for, so the specified design slots in cleanly without reworking the core. It does **not** aim to be endlessly extensible: because the system is fully explored, frameworked, and specified before it is built, it is meant to be **closed off**, not held open for unbounded future growth. Build the seams the known design needs — no speculative generality for features nobody has explored.
- **Separated** — clear boundaries; changes stay local; dependencies point in one direction.
- **Cohesive** — things that change together live together; each module has one job.
- **Understandable** — a new developer can navigate it without a map.

### Complexity target — required input, set first

Before working any decision, get one thing from the user explicitly: **how simple or complex should this architecture be?** This *Simple Rules vs Complex System* choice is a binding ceiling on every decision that follows, not an afterthought. Default toward the simplest design that satisfies the framework; reach for a more capable, more general, or more variable-hungry design only when the user has asked for that level.

Use a shared 1–5 scale so the target is unambiguous:

1. **Basic** — the least machinery that works; hard-coded or single-path where that suffices.
2. **Simple** — a few clear rules; minimal moving parts; easy to reason about end to end.
3. **Moderate** — structured rules with some configurability; a modest engine where it earns its place.
4. **Intricate** — several interacting subsystems, richer state and configuration.
5. **Complex** — a full engine/framework that weighs many variables and adapts.

Set it at the level it applies: **per feature** in a `<Feature>.architecture.md`, or **project-wide** in `architecture.md` as a bound every feature inherits. Record the number and label, and treat it as a **ceiling** — flag any decision that would push past it. It is required input; don't leave it open. If the user genuinely defers, default to **2 (simple)**, record that, and flag it.

Why it matters (examples, illustrative not prescriptive):

- **Game AI / decision-making.** The reflex is an AI that weighs as many variables and circumstances as possible. Often that's the wrong call: a level-2 set of simple rules can produce believable, cheap, predictable, debuggable behavior where a level-5 utility/behaviour engine is fragile and hard to tune. Choose the level deliberately instead of defaulting to maximum capability.
- **Engine vs rules, generally.** For many problems a purpose-built engine and a handful of simple rules reach nearly the same outcome — the rules getting ~80% of the result with a fraction of the code, surface area, and failure modes. If 80% at level 2 beats 100% at level 5 for this feature, that is the user's call to make here.

Carry the target into every decision below: prefer the option that meets the framework at or under the target, and exceed it only on the user's explicit say-so.

### Decision areas to cover (as relevant)

Not every project needs every area — pick what the frameworks actually demand.

- **Overall shape / layering** — the organizing pattern and where code lives.
- **Module & component boundaries** — what the units are, and their public surfaces.
- **Dependency direction** — what may depend on what; where the core sits.
- **State & data ownership** — who owns what state; how data flows.
- **Persistence & infrastructure** — database kind (relational / document / key-value / in-memory / file / SO-asset for Unity), caching, messaging, hosting. Each as a decision with reasons and drawbacks.
- **Extensibility strategy** — the seams the explored design actually needs (interfaces, events, plugins, data-driven config), kept bounded: enough for the framework's known variations, not speculative openness for unexplored futures.
- **Cross-cutting concerns** — logging, error handling posture, configuration, auth — at the level of *where they live*, not how they're coded.
- **Standing guidelines** — the rules future code follows (e.g. "domain logic must not reference infrastructure", "features are vertical slices", "prefer composition for behaviors").

## Output: architecture.md

When the user has made the decisions, write the file next to `CLAUDE.md` (confirm the filename first): `architecture.md` for the project, or `<Feature>.architecture.md` for a feature-scoped architecture. Keep it at the guideline level — no class or method detail.

```markdown
# Architecture — <Project | Feature>

**Created:** <ISO date>
**Derives from:** <framework.md, and any feature frameworks it draws on>
**Complexity target:** <1–5 + label — e.g. "2 (simple)"> (scope: feature | project)

## Overview
<a few sentences: the organizing approach and why it fits the designs>

## Guidelines
<the standing rules future code must follow — separation, dependency
direction, cohesion, bounded expansibility, understandability, and the
complexity ceiling. Each rule is checkable, so the reviewer can flag
violations and the implementer can tell when a design would offend it.>

## Structure
<layers / modules / components, their responsibilities and boundaries,
and the direction of dependencies and data flow. Conceptual — no classes.>

## Decisions
<one entry per significant choice:>

### D1: <decision>
- **Chosen:** <the option the user picked>
- **Why:** <reasons it fits>
- **Drawbacks:** <what it costs / makes harder / locks in>
- **Alternatives considered:** <options + the tradeoff that lost them>

## Infrastructure
<database, caching, messaging, hosting — each as a decision entry above,
or summarized here with a pointer.>

## Extensibility
<the seams the explored design needs, and where the specified features attach — bounded, not open-ended>

## Relation to project architecture
<feature-level files only: which project guidelines it inherits, and how
it stays within them>

## Open questions
<undecided architectural choices, each with a recommended default and its tradeoffs>
```

## How downstream skills consume architecture.md

State this contract when handing off, so the user knows what to expect:

- **The specifier and planner** work *within* these guidelines and decisions — they don't re-open architectural choices.
- **The implementer** must respect the architecture, and — importantly — must **flag when an implementation it needs to write would offend the architecture**, surfacing it to the user rather than silently violating it or silently contorting the code. That's the user's cue to intervene (adjust the code, or amend the architecture here).
- **The reviewer** checks implemented code against `architecture.md` and reports violations as findings.

The architecture is a set of boundaries, not a straitjacket: when reality and the architecture collide, the answer is to surface the collision, not to hide it.

## Handoff

When the file is written:

Architecture written to <file>. It derives from <framework files> and sets
the guidelines and infrastructure decisions future code should follow.

Next step is specification. The specifier, planner, implementer, and
reviewer will all read this architecture and respect it. If building a
feature ever requires bending a guideline, the implementer will surface it
so you can decide.


Do not proceed to specification yourself.

## Behavior overrides from CLAUDE.md

At the start of every invocation, read the `## Skill Behaviors` section of `CLAUDE.md` and find the `### Architect` subsection (create it, with user confirmation, if the section exists but the subsection doesn't). Apply any rules there as additional instructions on top of this skill's normal procedure. The shared mechanism is documented in the specifier skill's `references/claude-md-behavior-section.md`.

Common rule types for the architect: preferred/forbidden patterns for this project ("no service locators", "relational only"), how much to lean toward simplicity vs extensibility, a default complexity level (1–5) for the project or specific features, which decision areas to always cover or always skip.

If a user's in-session steer should become a standing rule, don't absorb it silently — offer to add it to the `### Architect` subsection, propose the wording, show the diff, and write on confirmation.