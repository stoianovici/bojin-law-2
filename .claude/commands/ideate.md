# /ideate - Explore and Decide

**Purpose**: Understand a problem, explore the codebase, and converge on an implementation approach - all in one session.
**Mode**: Collaborative + parallel exploration
**Output**: `.claude/work/tasks/ideate-{slug}.md`

## Invocation

```
/ideate [topic]
```

---

## Why This Exists

Previously: `/brainstorm` (dialogue) → new session → `/research` (exploration)

Problem: Context lost at session boundary. Decisions made in brainstorm get diluted by the time research completes.

Now: One session that combines dialogue with live exploration.

---

## Execution Flow

### Phase 1: Understand (5 min dialogue)

**Load context first** (parallel reads):

```
- .claude/docs/project-brief.md
- .claude/docs/architecture.md
- .claude/work/current.md
```

Then ask:

1. What problem are we solving?
2. What's the expected outcome?
3. Any constraints I should know?

**Keep it brief** - don't over-discuss before seeing the code.

### Phase 2: Explore (background agents)

Once the problem is clear, launch **up to 3 background agents** while continuing conversation:

```
Agent 1: Find similar patterns in codebase
Agent 2: Identify files that would need to change
Agent 3: Answer specific technical question
```

**Key difference from old /research**: Agents run in background, results stream in while we talk.

As results arrive, share findings:

> "Agent found a similar pattern in `src/hooks/useEmail.ts:45` - they use..."

### Phase 3: Converge (decisions)

With exploration results in hand:

1. **Propose 2-3 approaches** based on what we found
2. **Discuss trade-offs** with user
3. **Lock in decisions** - be specific

**Decision format**:

```markdown
| What         | How                       | Verify                    |
| ------------ | ------------------------- | ------------------------- |
| [Capability] | [Implementation approach] | [User does X → Y happens] |
```

The "Verify" column is critical - it becomes the acceptance test.

### Phase 4: Output

**Write to**: `.claude/work/tasks/ideate-{slug}.md`

---

## Output Document

```markdown
# Ideate: [Topic]

**Status**: Complete
**Date**: [YYYY-MM-DD]
**Next**: `/plan ideate-{slug}` or `/implement` (if simple enough)

---

## Problem

[2-3 sentences - what we're solving and why]

## Decisions

| What         | How                 | Verify            |
| ------------ | ------------------- | ----------------- |
| [Decision 1] | [Specific approach] | [Observable test] |
| [Decision 2] | [Specific approach] | [Observable test] |

### Out of Scope

- [Explicitly not doing]

---

## Implementation Approach

[One paragraph: how to implement based on codebase exploration]

## Files

| File             | Action | Purpose                  |
| ---------------- | ------ | ------------------------ |
| src/path/file.ts | Modify | [maps to which decision] |
| src/path/new.tsx | Create | [maps to which decision] |

## Patterns to Follow

- [Pattern found in codebase with file:line reference]
- [Another pattern]

## Risks

| Risk                  | Mitigation      |
| --------------------- | --------------- |
| [What could go wrong] | [How to handle] |

---

## Next Step

If complex (3+ files): `/plan ideate-{slug}`
If simple (1-2 files): `/implement` directly

[Recommend which based on scope]
```

---

## Rules

- **EXPLORE WHILE TALKING** - don't wait for agents to finish before engaging
- **SHARE FINDINGS LIVE** - "I just found..." keeps user in the loop
- **BE SPECIFIC** in decisions - vague decisions = implementation drift
- **VERIFY COLUMN IS MANDATORY** - no decision without a test
- **NO CODE WRITING** - exploration only, implementation comes later
- **KEEP IT MOVING** - entire /ideate should take 10-20 minutes, not hours

## When to Skip /plan

If ideation reveals:

- Only 1-2 files to change
- Clear, non-complex implementation
- No dependencies or coordination needed

Then go directly to `/implement`. Don't force planning for simple work.

## Checkpoint Trigger

If ideation is running long (30+ minutes), use `/checkpoint` to save state:

```
/checkpoint ideate-{slug}
```

---

## Comparison to Old Workflow

| Aspect      | Old (brainstorm + research) | New (/ideate)     |
| ----------- | --------------------------- | ----------------- |
| Sessions    | 2 separate sessions         | 1 session         |
| Exploration | After decisions locked      | During discussion |
| Context     | Lost at boundary            | Preserved         |
| Duration    | Variable (often long)       | 10-20 min target  |
| Output      | 2 docs                      | 1 doc             |
