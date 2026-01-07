# /research - Parallel Investigation

**Purpose**: Discover the best implementation approach based on existing code + requirements.
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

The brainstorm doc contains all project context, decisions, and open questions. No other context loading needed.

---

## Inputs (from brainstorm doc)

- Project context (path, tech stack, integrations)
- Problem statement and decisions
- Open questions to investigate

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
Context: [Brainstorm summary + architecture overview]
Question: [Specific research question]
Scope: [Where to look]
Return: [What to report back]
```

### Example Agent Spawn

```
Agent 1: "Find existing patterns for [X] in src/. Report: file paths, patterns used, reusable code."
Agent 2: "Identify all files that handle [Y]. Report: file list, what each does, modification needs."
Agent 3: "Check package.json and imports for [Z] constraints. Report: available libraries, limitations."
```

## Synthesis

After all agents return:

1. Combine findings
2. Resolve conflicts
3. Form implementation recommendation

## Output: Task Document

**Write to**: `.claude/work/tasks/research-{slug}.md`

The task doc must be **self-contained** for a fresh session. Include:

```markdown
# Research: [Topic]

**Status**: Complete
**Date**: [YYYY-MM-DD]
**Input**: `brainstorm-{slug}.md`
**Next step**: `/plan research-{slug}`

---

## Context Summary

[Condensed from brainstorm: project path, tech stack, key decisions]

## Problem Statement

[From brainstorm]

## Research Findings

### Existing Code Analysis

- **Reusable**: [code/patterns to reuse with file paths]
- **Modify**: [files needing changes]
- **Create**: [new files needed]

### Patterns Discovered

[How similar things are done in this codebase, with examples]

### Integration Research

[API findings, library options, etc.]

### Constraints Found

- [Technical limitations]
- [Dependencies to consider]

## Implementation Recommendation

[Concrete approach based on research]

## File Plan

| File    | Action | Purpose |
| ------- | ------ | ------- |
| src/... | Create | ...     |
| src/... | Modify | ...     |

## Risks

- [Potential issues and mitigations]

## Next Step

Start a new session and run:
`/plan research-{slug}`
```

## Rules

- NO code writing (read-only phase)
- NO user interaction during research
- RETURN comprehensive summary
- CITE file paths for all findings

## Transition

When research is complete:

1. Write the task doc to `.claude/work/tasks/research-{slug}.md`
2. Tell user: "Research saved to `research-{slug}.md`. Start a new session and run `/plan research-{slug}`"
