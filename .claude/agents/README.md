# Sub-Agent Configs for the Implementation Cycle

These three files are **Claude Code sub-agent configurations**, not skills. They define the spawnable agents that the orchestrator skill coordinates. Each one points at the corresponding skill (generic or Unity, chosen by Project Context at spawn time).

## Files

- `planner.md` — the planning sub-agent. Tools: Read, Write, Edit, Glob, Grep (no Bash — it never runs code).
- `implementer.md` — the implementation sub-agent. Tools: Read, Write, Edit, Glob, Grep, Bash (Bash for build/test/lint).
- `reviewer.md` — the review sub-agent. Tools: Read, Glob, Grep, Bash (read-only review; no Write/Edit — it never modifies code).

## Installation

Place these files in your project's `.claude/agents/` directory (or the user-level `~/.claude/agents/` if you want them available across projects):

```
<project root>/
├── CLAUDE.md
├── .claude/
│   └── agents/
│       ├── planner.md
│       ├── implementer.md
│       └── reviewer.md
└── <feature folders>/
```

The agents are spawned by name (`planner`, `implementer`, `reviewer`), which is what the orchestrator skill's `agent-prompts.md` expects. Don't rename them without also updating the orchestrator.

## How they relate to the skills

The configs are thin. They define *identity, tool access, and which skills to preload* — nothing more. All the actual procedure lives in the skills:

| Sub-agent | Preloaded skills | Follows (non-Unity) | Follows (Unity) |
|---|---|---|---|
| planner | generic-planner, unity-planner | generic-planner | unity-planner |
| implementer | generic-implementer, unity-implementer | generic-implementer | unity-implementer |
| reviewer | generic-code-review, unity-code-review | generic-code-review | unity-code-review |

**Important:** sub-agents do NOT inherit the parent session's skills. Each config uses the `skills:` frontmatter field to preload both relevant skill families directly into the agent's context at spawn time. The agent then reads `CLAUDE.md`'s `## Project Context` section and *follows* whichever of the two preloaded skills matches the project — generic for non-Unity, Unity for Unity.

This means both skill families are injected into the agent's context. If you only ever work in one type of project, you can trim each config's `skills:` list to just the one family you use, which reduces the agent's startup context. For example, a pure non-Unity setup would list only `generic-planner` in `planner.md` and drop `unity-planner`.

## Prerequisites

For the full cycle to work, you need:

1. **The orchestrator skill** installed (`generic-orchestrator` and/or `unity-orchestrator`).
2. **The role skills** installed (planner / implementer / reviewer families).
3. **These three sub-agent configs** in `.claude/agents/`.
4. **A CLAUDE.md** at the project root with a `## Project Context` section (the specifier writes this on first run).
5. **A feature folder** with a `Spec.md` (the specifier produces this).

The specifier skill (`generic-specifier` / `unity-specifier`) is the kickoff that sets up #4 and #5.

## Tool access rationale

The tool lists follow least privilege:

- **planner** has no Bash — it should never execute code. Restricting this means a planner that goes off-script can't run anything.
- **reviewer** has no Write or Edit — it reviews and reports, never fixes. Bash is allowed but only for read-only inspection (tests, linters in check mode, compilation checks). The config instructs it never to modify anything via the shell.
- **implementer** has the full set including Bash — it's the only role that writes code and validates it. It's also the riskiest; the reviewer is the safety net, so make sure the reviewer is configured to actually run tests if you want that safety.

Adjust these if your project needs differ. For example, if you want the reviewer to have no shell access at all (pure static review), remove Bash from `reviewer.md`. If you want to restrict the implementer's Bash to specific commands, Claude Code supports finer-grained tool permissions — consult the current Claude Code docs for the exact syntax, as it may have changed.

## Notes on Claude Code behavior (verified against current docs)

These facts were confirmed against the current Claude Code documentation:

- Sub-agents are markdown files with YAML frontmatter (`name`, `description`, `tools`, `skills`, optionally `model`, `permissionMode`, etc.), placed in `.claude/agents/` (project) or `~/.claude/agents/` (user). Project scope wins on name collision.
- **Omitting the `tools` field grants the agent ALL tools** (including MCP tools) by inheritance. The explicit tool lists in these configs are therefore doing real work — they restrict access. Don't remove them unless you intend full access.
- **Sub-agents do not inherit the parent's skills.** The `skills:` field preloads them explicitly; that's why each config lists its skill families.
- Sub-agents run in isolated context windows and return only a summary to the parent. They don't see conversation history — which is why the orchestrator passes everything in the spawn prompt.

There are additional frontmatter fields you may want to explore: `model` (run a role on a cheaper/faster model — e.g. the reviewer on a smaller model), `permissionMode`, `disallowedTools`, and `maxTurns`. These weren't needed for the base setup but could be useful as you tune. Consult the current Claude Code docs (code.claude.com/docs) for the authoritative and up-to-date field list, since the feature set evolves.
