# Escalation Report Format

When an escalation condition fires, the orchestrator stops the loop and presents this report to the user. The user then decides whether to continue (possibly with adjusted thresholds), restructure the spec/plan, or end the cycle.

## When to escalate

See the "Escalation" section of SKILL.md for the trigger conditions. They fall into four buckets:
- Planner anomalies.
- Implementer anomalies.
- Reviewer anomalies (per iteration).
- Trend anomalies (across iterations).
- Hard cap: reviewer's own 3-iteration limit was hit with findings still present.

## Report format

```markdown
# Escalation: <feature_name>

**Condition:** <which escalation rule fired, in plain language>
**Outer iteration:** <N>
**Step that triggered it:** <planner | implementer | reviewer>

## What happened

<2–4 sentences describing the situation. Concrete, not editorial. Example: "The reviewer returned 14 findings on iteration 2, more than iteration 1's 9. Findings are not descending, which suggests the implementer is regressing rather than converging.">

## Evidence

<the specific numbers or outputs that triggered the rule>

- Iteration 1: 9 findings (3 bug, 4 perf, 2 style)
- Iteration 2: 14 findings (5 bug, 6 perf, 3 style)
- New findings in iteration 2 not present in iteration 1: 8

## Options for the user

The orchestrator offers a small, concrete menu — not open-ended questions. Typical options:

1. **Continue anyway.** Treat this report as informational and let the loop proceed.
2. **Adjust the threshold that fired.** E.g. "actually, ≥10 first-iteration findings is fine for this feature, raise it to 15."
3. **Restructure the spec or plan.** End this cycle, let the user revise Spec.md, then start a new cycle.
4. **End the cycle here.** Accept the current state, write the final summary based on what was built so far, and stop.

If the situation is unusual enough that none of these fit, ask an open question instead — but default to the menu.

## State

A Handoff.md has been saved alongside this report so the cycle can be resumed if the user chooses to continue.
```

## Tone

- Direct. The user is being asked to make a decision; don't bury the lede.
- Concrete numbers, not adjectives. "14 findings, 8 of them new" beats "the reviewer found a lot of new issues."
- No editorializing about whose fault it is. The orchestrator is reporting, not assigning blame.
- Short. The user will read this and immediately decide; don't make them wade.

## After the user decides

- If continue → resume the loop from where it stopped.
- If adjust threshold → update the threshold for the rest of this cycle (and note it in Handoff.md so resume sessions inherit it), then resume.
- If restructure → archive Handoff.md, leave Spec.md for the user to edit, end the orchestrator session.
- If end → write the final summary based on the most recent successful implementation state, archive Handoff.md, stop.
