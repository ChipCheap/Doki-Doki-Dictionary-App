# Technical Probing Checklist

Prompts for Phase 3. The framework already decided *what* the feature is and its
*business* error cases. This skill probes the **technical** layer and the
**gaps** — how the system behaves when reality doesn't match the happy path, and
where the explored goal isn't yet reachable as written. Adapt to the feature and
the Project Context language; don't ask mechanically.

## How to probe well

- **Batch, don't drip.** Ask the whole set for an area at once.
- **Only valid, non-obvious questions.** If the framework or the user's words
  already answer it, don't ask. A question earns its place only when a wrong
  default would produce wrong code.
- **Frame as completeness, not gotchas.** "Let's make sure we've decided X."
- **Capture every "won't happen" as an Assumption** for the plan, not a dropped
  question.
- **Cross-feature/framework concerns: only if critical or contradictory.** Those
  belong to exploration; raise one here only for a genuine contradiction or a
  blocker.
- **Use language-appropriate failure vocabulary** — HTTP errors vs panics vs
  exceptions; null refs vs missing components in Unity.

## Illegal / invalid action probes

For any system that accepts input, actions, commands, or events:

- "What happens when an action arrives that isn't valid for the current state —
  rejected, queued, ignored, error?" (the classic: an illegal action passed into
  an action handler.)
- "What validates the input, and where — at the boundary, or deep in the logic?"
- "Malformed, out-of-range, wrong-type, or missing input — what's the defined
  response?"
- "What if this is triggered when it shouldn't be — during teardown,
  mid-transaction, before initialization, after disposal?"
- "Is there a legal-but-surprising input the design hasn't accounted for?"

## Ordering, timing & concurrency probes

- "Can two of these run at once? What happens if they do?"
- "Does order matter across steps or across systems? What enforces it?"
- "What if a dependency responds out of order, late, or twice?"
- "Unity: does this depend on update/lifecycle order, or on something existing
  by a certain frame?"

## Partial-failure & state probes

- "If this fails halfway, what state is left behind — is it consistent?"
- "Is there rollback, compensation, or a retry, or does it surface the failure?"
- "What survives a restart, reload, crash, or going offline mid-operation?"
- "What's the observable result when it fails — to the user, to the caller?"

## Gap-closing probes (achievability)

These make sure the explored goal can be reached *in completion*:

- "The framework assumes <X> is available here — where does it come from, and
  what if it isn't?"
- "This transition is named but not defined — what exactly triggers it and what
  are its preconditions?"
- "Who owns the lifetime of <resource>? When is it created and destroyed?"
- "The goal implies <capability> — is anything required for it missing from the
  design?"

If a gap is a **design** hole (the framework's intent is under-decided, not just
its mechanics), don't invent design — surface it and offer to send it back to
exploration.

## When to stop

Stop when every framework goal has its technical handling decided, the gaps that
block achievability are closed, and further questions would only restate what's
already known. Then draft the plan and let the user react to a concrete
document — a draft surfaces remaining gaps faster than more questions.

## Anti-patterns

- Manufacturing edge cases that don't apply, to look thorough.
- Re-asking what the framework already decided (that's re-designing, not
  specifying).
- Raising non-critical cross-feature worries the explorer already owned.
- Probing in series instead of batching.
