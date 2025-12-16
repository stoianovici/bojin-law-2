# Operations Status Dashboard

Display a comprehensive overview of operations status including environment health.

## 1. Read Operations Log

Read `docs/ops/operations-log.md`

## 2. Run Quick Health Checks

Run these checks in parallel:

```bash
# Check parity
pnpm check-parity

# Check git status
git status --porcelain

# Check current branch
git branch --show-current
```

## 3. Parse and Display Status

Show a formatted dashboard:

```
## Operations Dashboard

### Environment Health

| Check        | Status | Details                          |
| ------------ | ------ | -------------------------------- |
| Parity       | ✓/✗    | Dev/prod alignment               |
| Git          | ✓/✗    | {clean/uncommitted changes}      |
| Branch       | ✓/✗    | {main/other branch}              |

{If any ✗}: Run `/ops-verify` for full diagnostics

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
  - Root Cause Found: {n}
  - Fixing: {n}
  - Verifying: {n}
- **Total Sessions**: {sum of all session counts}
- **Avg Sessions per Issue**: {average}

### Quick Actions

| Action | Command | Description |
| ------ | ------- | ----------- |
| New issue | `/ops-new "description"` | Create new issue |
| Continue | `/ops-continue` | Resume most recent |
| Continue specific | `/ops-continue OPS-XXX` | Resume specific issue |
| Investigate | `/ops-investigate "symptom"` | Parallel investigation |
| Verify | `/ops-verify` | Check local/prod parity |
| Deploy | `/ops-deploy` | Deploy to production |
| Close | `/ops-close OPS-XXX` | Close resolved issue |
```

## 4. Environment Quick Reference

Always show environment commands:

```
### Environment Commands

| Purpose | Command |
| ------- | ------- |
| Local dev (default) | `pnpm dev` |
| With production data | `source .env.prod && pnpm dev` |
| Production Docker | `pnpm preview` |
| Quick verification | `pnpm preflight:quick` |
| Full verification | `pnpm preflight:full` |
| Parity check | `pnpm check-parity` |
| Smoke test | `pnpm smoke-test` |
```

## 5. Recommendations

If there are issues, provide recommendations:

### Priority Recommendations

- Highlight any P0/P1 issues that haven't been touched recently
- Suggest which issue to work on next based on priority and staleness
- Note any issues stuck in the same status for multiple sessions

### Environment Recommendations

```
{If parity check failed}:
⚠️ Parity issues detected - run `/ops-verify` before any deployment

{If uncommitted changes}:
⚠️ Uncommitted changes - consider `/ops-commit` or stash

{If not on main branch}:
ℹ️ On branch {branch} - merge to main before deploying

{If all healthy}:
✓ Environment healthy - ready for development or deployment
```

### Suggested Next Action

Based on current state, suggest one action:

```
## Suggested Next Action

{Based on status}:

If P0/P1 issue exists and not in progress:
  → `/ops-continue OPS-XXX` - Resume high-priority issue

If issue is in "Fixing" status:
  → Continue fixing, then `/ops-verify` before deploy

If issue is in "Verifying" status:
  → `/ops-close OPS-XXX` if verified, or continue testing

If no active issues:
  → `/ops-new` to create new issue, or you're all caught up! 🎉
```

## 6. Recent Commits (Optional)

Show last 3 commits for context:

```
### Recent Commits

| Hash | Message | Date |
| ---- | ------- | ---- |
| abc123 | fix: ... (OPS-024) | 2h ago |
| def456 | wip: ... (OPS-024) | 5h ago |
| ghi789 | feat: ... | 1d ago |
```

## Important Rules

- This is a read-only command - don't modify the ops log
- Keep output concise and scannable
- Sort by priority (P0 first) then by last active date
- Always run health checks to provide current status
- Always show environment commands reference
