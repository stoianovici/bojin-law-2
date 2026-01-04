# /research - Parallel Investigation

**Purpose**: Investigate codebase to find the best implementation approach for brainstorm decisions.
**Mode**: Autonomous (Claude works independently, user waits for results)
**Input**: `.claude/work/tasks/brainstorm-{slug}.md`
**Output**: `.claude/work/tasks/research-{slug}.md`

## Invocation

```
/research brainstorm-{slug}
```

## Auto-load Context (first step)

```
Read: .claude/work/tasks/brainstorm-{slug}.md → Full context from brainstorm phase
```

The brainstorm doc contains problem statement, decisions, and open questions.

---

## Execution: Spawn 3-5 Parallel Agents

### Agent Distribution

Based on complexity, spawn appropriate number:

**Simple research (3 agents)**:

1. Existing patterns & code to reuse
2. Files that need modification
3. Dependencies & constraints

**Complex research (5 agents)**:

1. Existing patterns & code to reuse
2. Files that need modification
3. Dependencies & constraints
4. External docs/APIs (if applicable)
5. Similar implementations in codebase

### Agent Task Template

Each agent receives:

```
Context: [Problem statement + Decisions from brainstorm]
Question: [Specific research question]
Scope: [Where to look]
Return: [What to report back]
```

## Synthesis

After all agents return:

1. Combine findings
2. Answer the Open Questions from brainstorm
3. Form implementation recommendation that honors the Decisions

---

## Output: Task Document

**Write to**: `.claude/work/tasks/research-{slug}.md`

```markdown
# Research: [Topic]

**Status**: Complete
**Date**: [YYYY-MM-DD]
**Input**: `brainstorm-{slug}.md`
**Next step**: `/plan research-{slug}`

---

## Problem Statement

[Copy from brainstorm - unchanged]

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from brainstorm doc.
> These are the agreed requirements. Research informs HOW, not WHAT.

### Functional Decisions

[Copy table from brainstorm exactly]

### Technical Decisions

[Copy table from brainstorm exactly]

### Out of Scope

[Copy from brainstorm exactly]

---

## Research Findings

### Open Questions - Answered

| Question          | Answer          | Evidence                    |
| ----------------- | --------------- | --------------------------- |
| [From brainstorm] | [What we found] | [File paths, code examples] |

### Existing Code Analysis

| Category        | Files   | Notes                 |
| --------------- | ------- | --------------------- |
| **Reuse as-is** | [paths] | [what to reuse]       |
| **Modify**      | [paths] | [what changes needed] |
| **Create new**  | [paths] | [what to create]      |

### Patterns Discovered

[How similar things are done in this codebase, with specific file:line examples]

### Constraints Found

- [Technical limitations discovered]
- [Dependencies to consider]

---

## Implementation Recommendation

[Concrete approach that honors the Decisions. Explain HOW to implement WHAT was decided.]

## File Plan

| File    | Action | Purpose                  |
| ------- | ------ | ------------------------ |
| src/... | Create | [maps to which Decision] |
| src/... | Modify | [maps to which Decision] |

## Risks

| Risk                  | Mitigation         |
| --------------------- | ------------------ |
| [What could go wrong] | [How to handle it] |

---

## Next Step

Start a new session and run:
`/plan research-{slug}`
```

---

## Rules

- NO code writing (read-only phase)
- NO modifying Decisions - research informs HOW, not WHAT
- ANSWER all Open Questions from brainstorm
- CITE file paths for all findings
- MAP file plan back to Decisions

## Transition

When research is complete:

1. Write the task doc to `.claude/work/tasks/research-{slug}.md`
2. Tell user: "Research complete. Start a new session and run `/plan research-{slug}`"
