# Create New Operations Issue

You are starting a new operations issue tracking workflow. Follow these steps precisely.

**IMPORTANT**: All issues track Local Verification Status. See `ops-protocol.md` for details.

## 1. Read Current State

First, read these files in parallel:

- `docs/ops/operations-log.md` - Get the current issue count
- `docs/ops/root-cause-patterns.md` - Reference for initial triage
- `docs/project-conventions.md` - Code patterns and implementation standards
- `.claude/commands/ops-protocol.md` - Verification gate protocol

Determine the next issue ID (OPS-XXX) by finding the highest existing ID and incrementing.

## 2. Gather Issue Information

The user's input is: $ARGUMENTS

If the input is empty or unclear, ask for:

1. **Title**: Brief description of the issue
2. **Type**: Bug / Feature / Performance / Security / Refactor / Documentation
3. **Priority**: P0-Critical / P1-High / P2-Medium / P3-Low

If the input contains a clear description, infer type and priority, then confirm with user.

## 3. Initial Triage

Perform quick triage:

1. **Read project conventions** - Read `docs/project-conventions.md` to understand implementation patterns
2. Use the Explore agent (Task tool with subagent_type=Explore) to search the codebase for related code
3. Check for similar past issues in the ops log
4. Identify potentially relevant files
5. **Discover local dev environment** - Check for local development setup

## 4. Determine Environment Strategy

Based on issue type, recommend the appropriate environment:

**For Bugs (especially "works locally, fails in prod"):**

```
Recommended: Connect to production database for real data debugging

To enable:
  source .env.prod && pnpm dev

This gives you:
- Real production data (same as users see)
- Same database state
- Fast iteration with hot reload

Caveats:
- Auth uses SKIP_AUTH_VALIDATION=true (can't fully replicate Azure AD locally)
- Be careful with mutations - this is real data!
```

**For Features:**

```
Recommended: Use local database for development

To enable:
  pnpm dev (default)

Switch to prod data for integration testing:
  source .env.prod && pnpm dev
```

## 5. Create Issue Entry

Add a new issue to the "Active Issues" section of `docs/ops/operations-log.md`:

```markdown
### [OPS-XXX] {title}

| Field           | Value                   |
| --------------- | ----------------------- |
| **Status**      | New                     |
| **Type**        | {type}                  |
| **Priority**    | {priority}              |
| **Created**     | {today's date}          |
| **Sessions**    | 1                       |
| **Last Active** | {today's date and time} |

#### Description

{description from user or inferred}

#### Reproduction Steps

- TBD (to be filled during investigation)

#### Root Cause

TBD

#### Fix Applied

TBD

#### Environment Strategy

| Mode                   | Command                        | Use When                     |
| ---------------------- | ------------------------------ | ---------------------------- |
| Local dev (default)    | `pnpm dev`                     | Feature development          |
| Production data        | `source .env.prod && pnpm dev` | Bug investigation, real data |
| Production-like Docker | `pnpm preview`                 | Pre-deploy verification      |
| Full parity check      | `pnpm preflight:full`          | Before any deployment        |

**Recommended for this issue**: {local/prod-data/docker based on type}

#### Local Verification Status

| Step           | Status     | Date | Notes |
| -------------- | ---------- | ---- | ----- |
| Prod data test | ⬜ Pending |      |       |
| Preflight      | ⬜ Pending |      |       |
| Docker test    | ⬜ Pending |      |       |

**Verified**: No

> ⚠️ Issue cannot be closed until all three steps are ✅

#### Conventions to Follow

{note any specific conventions from docs/project-conventions.md relevant to this issue}

#### Session Log

- [{timestamp}] Issue created. Initial triage: {brief triage findings}

#### Files Involved

- {list any files identified during triage}

---
```

## 6. Update Quick Reference

Add a row to the Quick Reference table at the top of the ops log.

## 7. Create Handoff Notes

Write initial context to `.ai/ops-{issue-id}-handoff.md` with:

```markdown
# Handoff: [OPS-XXX] {title}

**Session**: 1
**Date**: {timestamp}
**Status**: New

## Issue Summary

{description}

## Initial Triage Findings

{findings}

## Environment Strategy

**Recommended**: {local/prod-data}

- For debugging: `source .env.prod && pnpm dev`
- For testing: `pnpm preview`

## Local Verification Status

| Step           | Status     | Notes |
| -------------- | ---------- | ----- |
| Prod data test | ⬜ Pending |       |
| Preflight      | ⬜ Pending |       |
| Docker test    | ⬜ Pending |       |

**Verified**: No

## Next Steps

1. {specific action}
2. {specific action}

## Files to Investigate

- {file paths}
```

## 8. Report to User

Summarize:

```
## Issue Created: [OPS-XXX] {title}

**Type**: {type}
**Priority**: {priority}
**Status**: New

### Initial Triage
{findings}

### Environment Recommendation
{prod data vs local recommendation}

### Local Verification Required
Before this issue can be closed, you must verify:
1. ⬜ Test with production data (`source .env.prod && pnpm dev`)
2. ⬜ Run preflight checks (`pnpm preflight:full`)
3. ⬜ Test in production Docker (`pnpm preview`)

### Next Steps
{recommendations}

To continue: `/ops-continue OPS-XXX`
```

## Important Rules

- Always use TodoWrite to track your progress through these steps
- Load files in parallel where possible
- Be methodical - document everything in the ops log
- The ops log is the source of truth across sessions
- **Always include Local Verification Status** - Required for closing
- **Always recommend environment strategy** based on issue type
