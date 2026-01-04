# /document - Record Work & Decisions

**Purpose**: Update work log with completed work and decisions made.
**Mode**: Autonomous (Claude updates files based on session)

## Auto-load Context (first step, parallel)

```
Read: .claude/work/current.md        → Existing work log
Run:  git diff --stat                → What changed
Run:  git status                     → Current state
```

---

## When to Use

- After completing implementation
- After making important decisions
- Before /checkpoint
- End of session

## Execution Steps

### 1. Gather Information

From current session:

- What was accomplished
- Files changed (from git diff)
- Decisions made and rationale
- Blockers encountered
- Next steps identified

### 2. Update Work Log

Append to `.claude/work/current.md`:

```markdown
---
## [DATE] - [Brief Title]

### Summary
[What was accomplished in 1-2 sentences]

### Changes
| File | Action | Description |
|------|--------|-------------|
| src/... | Created | ... |
| src/... | Modified | ... |

### Decisions
| Decision | Rationale |
|----------|-----------|
| Chose X over Y | Because... |

### Blockers
- [None / List any blockers]

### Next Steps
- [ ] [Next task 1]
- [ ] [Next task 2]
---
```

### 3. Update Decisions Log (if applicable)

If significant decisions were made, add to `.claude/docs/decisions.md`:

```markdown
## [DATE] - [Decision Title]

### Context

[Why this decision was needed]

### Options Considered

1. Option A - [pros/cons]
2. Option B - [pros/cons]

### Decision

[What was chosen]

### Rationale

[Why this option]

### Consequences

[What this means going forward]
```

### 4. Update Architecture (if applicable)

If project structure or patterns changed, update `.claude/docs/architecture.md`

## Output

```markdown
## Documentation Updated

### Work Log

- Added entry: "[Title]"
- Files documented: X

### Decisions Log

- [Updated with Y / No new decisions]

### Architecture

- [Updated / No changes]
```

## Rules

- KEEP entries concise
- FOCUS on decisions, not exploration
- CITE specific files
- CAPTURE rationale (future Claude needs to understand WHY)
