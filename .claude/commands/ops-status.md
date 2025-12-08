# Operations Status Dashboard

Display a quick overview of all operations issues.

## 1. Read Operations Log

Read `docs/ops/operations-log.md`

## 2. Parse and Display Status

Show a formatted dashboard:

```
## Operations Dashboard

### Active Issues ({count})

| ID | Title | Type | Priority | Status | Sessions | Last Active |
|----|-------|------|----------|--------|----------|-------------|
{table of non-resolved issues sorted by priority then last active}

### Recently Resolved ({count in last 7 days})

| ID | Title | Type | Resolved Date | Sessions |
|----|-------|------|---------------|----------|
{table of recently resolved issues}

### Statistics

- **Open Issues**: {count by status}
  - New: {n}
  - Investigating: {n}
  - Fixing: {n}
  - Verifying: {n}
- **Total Sessions**: {sum of all session counts}
- **Avg Sessions per Issue**: {average}

### Quick Actions

- `/ops-new "description"` - Create new issue
- `/ops-continue` - Resume most recent issue
- `/ops-continue OPS-XXX` - Resume specific issue
- `/ops-close OPS-XXX` - Close resolved issue
```

## 3. Recommendations

If there are issues, provide recommendations:

- Highlight any P0/P1 issues that haven't been touched recently
- Suggest which issue to work on next based on priority and staleness
- Note any issues stuck in the same status for multiple sessions

## Important Rules

- This is a read-only command - don't modify the ops log
- Keep output concise and scannable
- Sort by priority (P0 first) then by last active date
