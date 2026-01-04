# /context - Project Orientation (Optional)

**Purpose**: Get oriented with the project without starting a specific workflow.
**Mode**: Informational (read-only, no actions)

**Note**: This command is optional. When you know which task to continue, go directly to the relevant command (e.g., `/research brainstorm-linear-ui`).

Use /context when:

- Starting fresh and want to understand project state
- Returning after a break and need orientation
- Want to see available task docs

---

## Execution Steps

### 1. Load Project State (parallel reads)

```
Read simultaneously:
- .claude/docs/architecture.md    → Project structure & patterns
- .claude/docs/decisions.md       → Past decisions & rationale
- package.json                    → Dependencies & scripts
```

### 2. List Task Docs

```bash
ls -la .claude/work/tasks/        → Available task docs
```

### 3. Check Git State

```bash
git status                        → Uncommitted changes
git log --oneline -5              → Recent commits
```

### 4. Report to User

```markdown
## Project: bojin-law-ui

[1-sentence description]

## Task Docs Available

| File                 | Status   | Next Command                  |
| -------------------- | -------- | ----------------------------- |
| brainstorm-{slug}.md | Complete | `/research brainstorm-{slug}` |
| research-{slug}.md   | Complete | `/plan research-{slug}`       |
| plan-{slug}.md       | Approved | `/implement plan-{slug}`      |
| ...                  | ...      | ...                           |

## Git State

- **Uncommitted changes**: [yes/no, brief summary]
- **Recent commits**: [last 2-3]

## Suggested Next Step

Based on task docs:

- Continue: `/[command] {slug}` for [task doc name]
- Or: `/brainstorm [topic]` to start new work
```

## Rules

- READ-ONLY (no modifications)
- CONCISE summary (not exhaustive)
- POINT to specific task docs for continuation
