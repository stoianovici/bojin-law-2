# Create New Operations Issue

You are starting a new operations issue tracking workflow. Follow these steps precisely:

## 1. Read Current State

First, read the operations log to get the current issue count:

- Read `docs/ops/operations-log.md`
- Determine the next issue ID (OPS-XXX) by finding the highest existing ID and incrementing

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
5. **Discover local dev environment** - Check for local development setup:
   - Look for `.env` files in relevant services/apps
   - Check `package.json` for `dev` scripts (e.g., `npm run dev`)
   - Note any docker-compose files for local dependencies
   - Document findings in the issue for faster iteration during fixes

## 4. Create Issue Entry

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

#### Local Dev Environment

{document how to run locally, e.g., "cd services/gateway && npm run dev"}

#### Conventions to Follow

{note any specific conventions from docs/project-conventions.md relevant to this issue, e.g., "Romanian UI text", "Service singleton pattern", "Use clsx for classes"}

#### Session Log

- [{timestamp}] Issue created. Initial triage: {brief triage findings}

#### Files Involved

- {list any files identified during triage}

---
```

## 5. Update Quick Reference

Add a row to the Quick Reference table at the top of the ops log.

## 6. Create Handoff Notes

Write initial context to `.ai/ops-{issue-id}-handoff.md` with:

- Issue summary
- Initial findings from triage
- Suggested next steps
- Files to investigate

## 7. Report to User

Summarize:

- Issue ID created
- Initial triage findings
- Recommended next steps
- Command to continue: `/ops-continue {issue-id}`

## Important Rules

- Always use TodoWrite to track your progress through these steps
- Load files in parallel where possible
- Be methodical - document everything in the ops log
- The ops log is the source of truth across sessions
