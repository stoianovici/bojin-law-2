# /brainstorm - Collaborative Ideation

**Purpose**: Work together with user to find the best conceptual solution.
**Mode**: Collaborative (interactive dialogue, NOT autonomous)
**Output**: `.claude/work/tasks/brainstorm-{slug}.md`

## Auto-load Context (first step, parallel reads)

```
Read simultaneously:
- .claude/docs/project-brief.md   → What the project is, users, domain
- .claude/docs/architecture.md    → Technical patterns & stack
- .claude/docs/decisions.md       → Past decisions to consider
- .claude/work/current.md         → Active work & context
```

After loading, give a brief context acknowledgment:

> "I've loaded the project context. [1-sentence summary of relevant state for this topic]"

---

## Execution Steps

### 1. Understand the Problem

Ask clarifying questions:

- What problem are we solving?
- What's the expected outcome?
- Are there constraints I should know?
- Who/what is affected?

### 2. Explore Options Together

Generate 3-5 conceptual approaches:

```markdown
### Option A: [Name]

- How it works: [description]
- Pros: [benefits]
- Cons: [drawbacks]
```

### 3. Discuss Trade-offs

- Ask user's opinion on each option
- Challenge assumptions (both user's and mine)
- Identify risks and unknowns

### 4. Converge on Direction

- Summarize the chosen approach
- Note any open questions for /research
- Get explicit user confirmation

---

## Output: Task Document

**Write to**: `.claude/work/tasks/brainstorm-{slug}.md`

The task doc must be **self-contained** for a fresh session. The Decisions section is CRITICAL - it will be copied verbatim through all subsequent phases.

```markdown
# Brainstorm: [Topic]

**Status**: Complete
**Date**: [YYYY-MM-DD]
**Next step**: `/research brainstorm-{slug}`

---

## Problem Statement

[Clear, agreed-upon problem definition in 2-3 sentences]

## Decisions

> **IMPORTANT**: This section propagates unchanged through research → plan → implement.
> Be specific and complete. These are the requirements.

### Functional Decisions

| Decision | Details | Rationale | Verify |
| -------- | ------- | --------- | ------ |
| [What we decided] | [Specific details, not vague] | [Why this choice] | [How to test: "User does X → Y happens"] |
| [Example: "Reply with AI"] | [Composer with AI-drafted response] | [Core AI value-add] | [Click reply → AI draft appears in composer] |

> **The "Verify" column is critical** - it becomes the acceptance test in /plan and /test phases.
> Write it as: "User action → Observable result" or "Query X → Returns Y"

### Technical Decisions

| Decision | Details | Rationale | Verify |
| -------- | ------- | --------- | ------ |
| [What we decided] | [Specific details] | [Why this choice] | [How to verify technically] |

### Out of Scope

- [What we explicitly decided NOT to do]
- [Features to defer to later]

### Open Questions for Research

- [ ] [Specific question that needs code investigation]
- [ ] [Another question]

---

## Context Snapshot

[Brief summary of relevant project state - what exists, what this builds on]

## Next Step

Start a new session and run:
`/research brainstorm-{slug}`
```

---

## Rules

- NO code writing
- NO autonomous exploration (that's /research)
- STAY in dialogue mode
- CHALLENGE assumptions respectfully
- Don't over-engineer; simplest solution that works
- BE SPECIFIC in Decisions - vague decisions lead to implementation drift

## Transition

When user confirms direction:

1. Write the task doc to `.claude/work/tasks/brainstorm-{slug}.md`
2. Tell user: "Brainstorm saved. Start a new session and run `/research brainstorm-{slug}`"

## Full Workflow

```
/brainstorm → /research → /plan → /implement → /test → /commit
                                                  ↑       |
                                                  └─ fix ─┘
```
