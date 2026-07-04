# Probing Checklist

Concrete prompts to use during Phases 4–6. Adapt to the feature; don't ask them mechanically.

## How to probe well

- **Batch, don't drip.** If the user describes a requirement that needs five questions, ask all five together. The user can answer them as one block; you can write the spec in fewer rounds.
- **Frame as completeness, not gotchas.** "I want to make sure we've thought about X" beats "you forgot Y".
- **Don't fish for problems that don't exist.** If a feature is genuinely simple, don't pad it with edge cases that don't apply. The point is to surface real considerations, not to demonstrate thoroughness.
- **Capture the user's "no" answers explicitly.** When the user says "that case won't happen", that's not a dropped question — it's an Assumption to write into the spec.

## Happy path probes

For each requirement:

- "What triggers this — user action, game state change, a timed event, something else?"
- "What does the user / the game observe when this works?"
- "Is there a sequence of steps, or does it happen in one go?"
- "Who or what initiates it — the player, an NPC, the game systems, an event from another feature?"
- "What state does the world / player / system end up in?"

## Negative path probes

For each happy path:

- "What if the precondition for this isn't met? E.g. <specific precondition relevant to the feature>."
- "What if the input is invalid — out of range, wrong type, missing?"
- "What if this is triggered when it shouldn't be — while paused, mid-cutscene, during loading?"
- "What if it conflicts with another action happening at the same time?"
- "What's the user-visible feedback when it fails?"

## Edge case probes

- "What happens at the zero/empty case — empty inventory, no targets, zero damage?"
- "What happens at the max case — full inventory, max stack size, last frame before scene change?"
- "What happens on the first frame after a load or scene change?"
- "What if the relevant GameObject is disabled or destroyed during the operation?"
- "What if this happens multiple times in quick succession — debounce, queue, drop, allow?"
- "What if two of these happen at the same time?"

## External dependency probes

Only relevant if the feature integrates with external systems:

- "What does the feature expect from <dependency>? Is it always available?"
- "What happens if <dependency> fails — missing asset, corrupted save, null reference, network down?"
- "Is there a fallback behavior, or should the feature surface the failure to the user?"

Unity-flavored examples:

- "What if a referenced prefab is null in the inspector?"
- "What if the save file is from an older version of the game?"
- "What if a referenced Addressable isn't loaded yet?"
- "What if a scene transition happens mid-operation?"

## Boundary probes

These prevent scope drift. Ask explicitly:

- "Should this also handle <adjacent_thing>? Or is that a separate concern?"
- "Does this feature own <data_or_state>, or just read it from somewhere else?"
- "When this feature is complete, what should still be missing or done in a separate cycle?"
- "Are there UI / audio / VFX aspects, or just the underlying mechanic?"
- "Is this single-player only, or does multiplayer need to be considered?"
- "Persistence — does anything need to survive scene reloads or sessions?"

## When to stop probing

You've probed enough when:

- Each requirement has at least one happy path and at least one negative path described.
- Edge cases have been considered for any requirement that has obvious boundary conditions.
- Out-of-scope items have been listed explicitly when the user could reasonably have expected them included.
- The user's "no" answers and assumptions are captured.
- The user is signaling completion ("that's it", "I think that's everything", "looks good").

Don't probe past the point of diminishing returns. The planner's clarification round can catch what slipped through. The specifier's job is to get the spec to "good enough for the planner to work with," not "perfect."

## Anti-patterns

- **Probing in series.** Asking one question, waiting for the answer, asking the next. Slow and frustrating. Batch.
- **Asking questions whose answers are obvious from what the user already said.** Read what they said. Don't make them re-state it.
- **Asking about every theoretical edge case.** "What if the player's name is 200 emoji characters" is rarely the right question. Pick the cases that matter for this feature.
- **Probing instead of writing.** At some point, draft the spec from what you have and let the user react to a concrete document. Open-ended Q&A can drag on; a draft surfaces gaps faster than questions.
