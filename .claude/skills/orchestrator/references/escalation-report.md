# Escalation Report Format

When an escalation fires, the orchestrator stops the loop and shows this report.
The user then decides: continue (maybe with adjusted thresholds), restructure the
plan, or end the cycle.

## Buckets

See SKILL.md "Escalation" for triggers: re-plan (specifier) anomalies, implementer
anomalies, reviewer anomalies (levels 1–2 only), and trend anomalies.

## Report format

```markdown
# Escalation: <feature_name>

**Condition:** <which rule fired, in plain language>
**Outer iteration:** <N>
**Step that triggered it:** <implementer | reviewer | re-plan (specifier)>

## What happened
<2–4 concrete sentences. e.g. "The reviewer returned 14 findings on iteration 2,
up from 9 on iteration 1. Findings are not descending, which suggests the
implementer is regressing rather than converging.">

## Evidence
<the specific numbers/outputs that tripped the rule>
- Iteration 1: 9 findings (3 bug, 4 perf, 2 style)
- Iteration 2: 14 findings (5 bug, 6 perf, 3 style); 8 of them new

## Options for the user
1. **Continue anyway** — treat this as informational, let the loop proceed.
2. **Adjust the threshold that fired** — e.g. raise the first-iteration ceiling.
3. **Restructure the plan** — end this cycle, re-run the specifier to revise
   `<feature>.plan.md`, then start a new cycle.
4. **End the cycle here** — accept the current state, write the final summary,
   stop.

Prefer this concrete menu; only ask an open question if none fit.

## State
`<feature>.handoff.md` has been saved so the cycle can resume if the user
continues.
```

## Tone

Direct, concrete numbers not adjectives, no blame, short — the user reads it and
decides.

## After the user decides

- **Continue** → resume from where it stopped.
- **Adjust threshold** → apply it for the rest of the cycle, note it in the
  handoff so resumes inherit it, resume.
- **Restructure** → archive the handoff, hand back to the specifier to revise the
  plan, end this orchestrator session.
- **End** → write the final summary from the most recent good state, delete the
  handoff, stop.
