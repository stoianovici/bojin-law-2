# /brainstorm - Collaborative Ideation

**Purpose**: Work together with user to find the best conceptual solution.
**Mode**: Collaborative (interactive dialogue, NOT autonomous)
**Output**: `.claude/work/tasks/brainstorm-{slug}.md`

## Auto-load Context (first step, parallel reads)

```
Read simultaneously:
- .claude/docs/architecture.md    → Project structure & patterns
- .claude/docs/decisions.md       → Past decisions to consider
- .claude/work/current.md         → Active work & context
```

Brief context check: "I've loaded the project context. [1-sentence summary of relevant state]"

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

## Output: Task Document

**Write to**: `.claude/work/tasks/brainstorm-{slug}.md`

The task doc must be **self-contained** for a fresh session. Include:

```markdown
# Brainstorm: [Topic]

**Status**: Complete
**Date**: [YYYY-MM-DD]
**Next step**: `/research brainstorm-{slug}`

---

## Context

[Project path, tech stack, integrations - everything a new session needs]

## Problem Statement

[Clear, agreed-upon problem definition]

## Decisions

[All decisions made, with enough detail to implement]

## Rationale

[Why these choices over alternatives]

## Open Questions for Research

- [ ] [Specific question 1]
- [ ] [Specific question 2]

## Next Step

Start a new session and run:
`/research brainstorm-{slug}`
```

## Rules

- NO code writing
- NO autonomous exploration (that's /research)
- STAY in dialogue mode
- CHALLENGE assumptions respectfully
- Don't over-engineer; simplest solution that works

## Transition

When user confirms direction:

1. Write the task doc to `.claude/work/tasks/brainstorm-{slug}.md`
2. Tell user: "Brainstorm saved to `brainstorm-{slug}.md`. Start a new session and run `/research brainstorm-{slug}`"
