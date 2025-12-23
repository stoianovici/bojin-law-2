# Explore Ideas and Concepts

Brainstorm and explore without committing to implementation.

## Input

$ARGUMENTS - A question, challenge, or exploration:

- "how should we handle X?"
- "what's the best way to organize Y?"
- "ideas for improving Z"

## 1. Load Context

Read in parallel:

- `docs/project-conventions.md` - Current patterns
- `docs/ops/operations-log.md` - Recent work
- `CLAUDE.md` - Project overview

## 2. Clarify Scope (if needed)

Ask only if unclear:

- What problem prompted this?
- Any constraints?
- Exploratory or leaning toward implementation?

## 3. Gather Relevant Code

Use Explore agent to understand:

- How does the platform handle this today?
- What existing patterns are relevant?
- Any prior art in the codebase?

## 4. Present Multiple Angles

```markdown
## Exploring: {topic}

### Current State

{what exists today}

### The Challenge

{restate what we're exploring}

---

### Angle 1: {name}

**Idea**: {brief description}

**How it works**:

- {key point}
- {key point}

**Strengths**: {benefits}
**Trade-offs**: {considerations}
**Touches**: {affected files/areas}

---

### Angle 2: {name}

{same structure}

---

### Angle 3: {name}

{same structure}

---

### Synthesis

**Key tensions**: {trade-offs between approaches}
**Open questions**: {what would inform the decision}
**My take**: {honest assessment}
```

## 5. Next Steps

After presenting angles:

```
What next?
- Dig deeper into an angle
- Draft an issue → /ops-draft
- Keep exploring
- Park it for now
```

## 6. Draft Summary (when user chooses to draft)

When the user wants to proceed to `/ops-draft`, generate a structured summary block that captures the exploration outcome. This becomes the input for the drafting agent.

```markdown
## Draft Summary

**Title**: {concise issue title}

**Type**: {Bug | Feature | Performance | Refactor | Infra}

**Priority**: {P0-Critical | P1-High | P2-Medium | P3-Low}

**Problem**:
{1-2 sentences on what's wrong or missing}

**Solution**:
{Chosen approach from exploration, 2-3 sentences}

**Implementation**:

1. {Specific change with file path}
2. {Specific change with file path}
3. {Specific change with file path}

**Files to modify**:

- `path/to/file1.ts` - {what changes}
- `path/to/file2.tsx` - {what changes}

**Expected impact**: {measurable outcome}

**Dependencies**: {other issues or "None"}
```

After presenting this summary, tell the user:

```
Ready for /ops-draft - copy the summary above, or I can pass it directly.
```

## Guidelines

**DO**: Present multiple perspectives, acknowledge trade-offs, reference codebase, consider user impact

**DON'T**: Rush to single answer, create issues without asking, start implementing, over-engineer
