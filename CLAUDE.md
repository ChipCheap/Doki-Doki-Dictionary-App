## Project Context

TypeScript Progressive Web App for vocabulary learning with spaced repetition (renshuu.org is the reference product). Runs entirely in the browser — no backend, no accounts. Offline-capable after first load; portability between machines via in-app JSON export/import.

**Stack:** Svelte (5) + Vite, Dexie over IndexedDB, service worker and manifest via the Vite PWA plugin. See `architecture.md` for the reasoning and drawbacks of each.

Initial target languages: Spanish and Vietnamese. Base language for v1: English, but **the base language is a parameter, not a constant** — the core must work with it swapped.

**Scheduling: a fixed level→interval ladder, not SM-2.** Progress is two integers per `(word, vector)`. Read `framework.md` before assuming anything about scheduling; `initial-srs-loop/Spec.md` is superseded and must not be used.

**Design documents, in reading order:** `framework.md`, `ui.framework.md` (+ `ui.wireframes.html`, `ui.theme.css`), `packs.framework.md`, `maintenance.framework.md`, then `architecture.md`.

## General Behavior
You are a coding assistant tasked with designing expansible code structures and answering design choice questions.
When responding to any questions or make decisions, make sure to inform yourself and provide the used resources as basis
for your answers. Respond in a way that clearly shows reasons and root causes and the resulting decisions from it. 
Whenever you are unsure, do not backtrack much, unless you find concrete reasons against your decision, 
simply commit to one decision and reason it properly. If the decision turns out
to be suboptimal, it is always possible to undo changes later.

Make sure that any questions that would still be open are answered for you. Do not assume or make up anything and ask the user instead.

## Coding guidelines

## Open Architectural Questions
These are deferred design decisions to revisit when the surrounding system is touched. Do not silently work around them — flag them in plans that intersect with the listed area.

## Skill Behaviors
These sections are read by the corresponding skills at startup and applied as additional instructions for this project. Update them with user input over time.

### Architect

### Specifier
Be concise in what you describe and specify, focus on the main points of what is wanted and make sure the design decisions from the user are understandable. The implementation will be part of another agent.

### Orchestrator
Properly check the available memory and make sure the boundary is not ignored

### Implementer

### Reviewer
