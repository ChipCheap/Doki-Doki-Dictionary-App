# Architectural Pauses

When to stop implementing and ask the user — versus when to just decide.

The rule from the SKILL.md is: pause immediately on architectural ambiguity. This file defines what counts as architectural ambiguity and what doesn't, with concrete examples. The point of pausing is that placement decisions cascade — a wrong choice early ripples into later steps.

## What requires a pause

These are decisions where the wrong call propagates beyond the current step. Always pause and ask.

**1. Where a new top-level type or module lives.**
The plan calls for a new service or component but doesn't say which folder, package, or module. The choice between competing locations is not interchangeable — it affects import paths, build dependencies, ownership conventions, and other code's ability to reach it.

**2. What kind of thing it is (in projects with multiple kinds of "thing").**
The plan describes behavior but doesn't say where it lives in the project's architecture. Common cases:
- Module-level function vs class method vs free-standing utility.
- Stateful service vs stateless function.
- Long-lived singleton vs request-scoped instance vs transient.
- Synchronous vs asynchronous variant.
- Library code vs application code vs framework extension.

Each has different implications for lifecycle, testability, and access patterns. Pause.

**3. How a new component is reached from existing code.**
The plan describes that "X should be able to call Y" but doesn't say through what mechanism:
- Direct reference.
- Injected dependency.
- Service locator or registry.
- Event/message dispatch.
- Plugin / hook.

The project's existing pattern matters and the choice cascades.

**4. Public API shape for a new interface.**
The plan introduces a new public interface or trait but doesn't specify the exact method signatures. If the same operation could be expressed as `getX(id)` or `findX({id})` or `users.get(id)`, the choice affects every caller and is hard to change later.

**5. Which existing component to extend vs. create a new one.**
The plan calls for new behavior that could either be added to an existing module or warrant a new one. The answer depends on the project's conventions for module size and responsibility.

**6. Cross-cutting boundary changes.**
A new type that spans gameplay and UI, frontend and backend, application and library: which side does it live in? Wrong side causes cyclic dependencies that surface much later.

**7. Schema-affecting decisions.**
Database migrations, API contracts, message formats — anything that affects external compatibility or other team members' work. Even if the plan is otherwise clear, schema choices need user input unless the plan is very explicit about the schema.

## What does NOT require a pause

These are decisions that stay local to a single file or function. The implementer can decide and (if it's non-obvious) record a Technical note.

- Local variable naming and scoping inside a function.
- Whether a helper function is private/internal/file-scoped (within a single module).
- The shape of in-function data structures (Map vs object vs Array, for code that owns the lifetime).
- Choice of loop construct, error handling style, or other purely-local idioms.
- Splitting a long function into smaller private helpers.
- Type inference vs explicit types.

If a decision is local, just decide. If the user would have to look beyond one file to predict the consequences, pause.

## What to do in a pause

1. **Stop implementing.** Do not finish the current step "for now and come back".
2. **Identify all the placement questions at once.** If you've paused for one, look ahead in the plan for related ones — the user can answer them together.
3. **Ask the user, batched.** Include for each question:
   - The plan step it concerns.
   - 2–3 candidate options (with their tradeoffs).
   - Which option the implementer would default to if forced, and why.
4. **Wait for the answer.** Do not implement around the question and patch it later.

Example format:

```
I need a placement decision before continuing S3.

**Question:** Where should `UserService` live, and what kind of type is it?

Plan step S3 says "create UserService and register it for downstream
consumers to query." The plan doesn't specify the type's nature.

Options I see:
- **Module-scope singleton exported from src/services/user-service.ts**
  — matches the existing pattern for `AuthService`. Easiest to access
  from anywhere but couples to module load order.
- **DI-registered service** — matches `PaymentService`. Cleaner for
  testing, but requires the user to confirm whether this project's DI
  container is the right home for it.
- **Request-scoped factory** — best for per-request state, but the plan
  doesn't suggest user state is request-scoped.

I'd default to option 1 (module-scope singleton) to match `AuthService`,
unless you'd prefer one of the others.
```

The user picks, the implementer notes the choice as a Technical note (with user confirmation per Phase 3), and implementation resumes.
