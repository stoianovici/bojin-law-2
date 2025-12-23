# Create New Operations Issue

Create and track a new issue.

## Input

$ARGUMENTS - Issue description. If empty, will ask for details.

## 1. Get Next ID

Read `docs/ops/operations-log.md`, find highest OPS-XXX, increment.

## 2. Gather Info

From input or ask:

- **Title**: Brief description
- **Type**: Bug / Feature / Performance / Infra
- **Priority**: P0-Critical / P1-High / P2-Medium / P3-Low

## 3. Quick Triage

Use Explore agent to:

- Search codebase for related code
- Check for similar past issues
- Identify relevant files

## 4. Create Issue File

Create `docs/ops/issues/ops-{id}.md`:

```markdown
# [OPS-XXX] {title}

**Type**: {type}
**Priority**: {priority}
**Status**: Open
**Created**: {date}

## Description

{description}

## Investigation

{triage findings}

## Root Cause

TBD

## Fix

TBD

## Files

- {relevant files from triage}
```

## 5. Update ops-log

Add row to Quick Reference table:

```markdown
| OPS-XXX | {title} | {type} | {priority} | Open | [issues/ops-XXX.md](issues/ops-XXX.md) |
```

## 6. Report

```
Created: [OPS-XXX] {title}
Type: {type} | Priority: {priority}
File: docs/ops/issues/ops-{id}.md

Initial findings: {triage summary}
Files to investigate: {list}

Continue with: /ops-continue OPS-XXX
```
