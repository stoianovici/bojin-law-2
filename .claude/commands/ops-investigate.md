# Parallel Investigation

Run parallel hypothesis exploration to quickly identify root cause, then create/update an issue with findings.

**IMPORTANT**: This command creates issues with Local Verification Status. See `ops-protocol.md` for details.

## Input

The user's input is: $ARGUMENTS

This should be either:

- An OPS issue ID (e.g., "OPS-024") - will update existing issue
- A symptom description (e.g., "documents not appearing") - will create new issue

## 1. Load Context

Read in parallel:

- `docs/ops/operations-log.md` - Current issues
- `docs/ops/root-cause-patterns.md` - Known patterns
- `docs/ops/deployment-flows.md` - Parity information
- `.claude/commands/ops-protocol.md` - Verification gate protocol
- If issue ID provided: `.ai/ops-{id}-handoff.md`

## 2. Classify Symptom Type

Determine the symptom category to select the right hypotheses:

**Category A: "X not appearing in UI"**

- Data exists but not displayed
- Usually frontend/API issue

**Category B: "X works locally, fails in production"**

- Environment parity issue
- Usually env vars, build, or runtime

**Category C: "X fails everywhere"**

- Core logic bug
- Usually backend/service issue

**Category D: "X is slow/timeout"**

- Performance issue
- Usually database/network/algorithm

## 3. Generate Hypotheses

Based on the symptom category, generate the appropriate hypotheses:

### For Category A: "X Not Appearing"

1. **Frontend**: Component not fetching/rendering data
2. **API**: Resolver not returning data / field mismatch
3. **Backend**: Data missing from DB / link table empty

### For Category B: "Works Locally, Fails in Prod" (MOST COMMON)

1. **Env Vars**: Missing or different environment variable in production
2. **Build/Compile**: TypeScript compiles locally but fails in Docker
3. **Runtime Parity**: Different Node version, dependencies in devDeps, etc.
4. **Database**: Migration not applied, schema drift

### For Category C: "Fails Everywhere"

1. **Logic Bug**: Code has incorrect logic
2. **Data Issue**: Unexpected data shape or null values
3. **External Service**: Third-party API changed or down

### For Category D: "Slow/Timeout"

1. **Database**: Missing index, N+1 queries
2. **Network**: External API latency
3. **Algorithm**: Inefficient code path

## 4. Spawn Parallel Agents

Launch investigation agents simultaneously based on category.

### For Category A (UI not appearing):

**Use Playwright MCP for live UI investigation:**

Before spawning code analysis agents, use Playwright MCP to see what the user sees:

```
Use playwright mcp to:
1. Navigate to the affected page (e.g., http://localhost:3000/cases)
2. Take a screenshot of the current state
3. Check the browser console for errors
4. Check network requests for failed API calls
5. Get a DOM snapshot of the relevant area
```

This gives you immediate visibility into:

- Whether the page loads at all
- JavaScript errors in console
- Failed network requests (404s, 500s, GraphQL errors)
- What elements are actually rendered

**Then spawn code analysis agents:**

```
Agent 1 - Frontend Investigation:
"Investigate if [symptom] is caused by frontend issues.
Check: component fetches data, no hardcoded arrays, state updates correctly.
Files to check: apps/web/src/app/[relevant-path], components, hooks.
Report: Does frontend properly request and render the data?"

Agent 2 - API Investigation:
"Investigate if [symptom] is caused by API layer issues.
Check: resolver registered, schema matches, field names correct.
Files to check: services/gateway/src/graphql/resolvers, schema files.
Report: Does GraphQL return the expected data?"

Agent 3 - Backend Investigation:
"Investigate if [symptom] is caused by backend/data issues.
Check: data exists in DB, link tables populated, migrations applied.
Files to check: services/gateway/src/services, Prisma schema.
Report: Does the data exist and is it properly linked?"
```

### For Category B (Works locally, fails in prod):

**Use Playwright MCP to compare local vs expected behavior:**

If the user reports something works locally but fails in production, use Playwright to verify local behavior first:

```
Use playwright mcp to:
1. Navigate to the affected page locally
2. Test the specific functionality
3. Take screenshots of the working state
4. Capture any network requests being made
```

This documents the "working" state to compare against production logs.

**Then spawn investigation agents:**

```
Agent 1 - Environment Variables:
"Investigate if [symptom] is caused by environment variable differences.
Check: Compare .env.prod to render.yaml envVars.
Check: Any new env vars added recently that might be missing in production?
Check: Any env var parsing differences (URLs, booleans, numbers)?
Files to check: .env.prod, .env.example, render.yaml, services/*/src/config.
Report: Are all required env vars set identically in both environments?"

Agent 2 - Build/Compile Parity:
"Investigate if [symptom] is caused by build differences.
Check: Does 'pnpm preflight:full' pass?
Check: Any TypeScript errors that might be masked locally?
Check: Dependencies in devDependencies that should be in dependencies?
Files to check: package.json files, tsconfig files, Dockerfiles.
Report: Does the code compile identically in both environments?"

Agent 3 - Runtime Parity:
"Investigate if [symptom] is caused by runtime differences.
Check: Node version matches (run 'pnpm check-parity').
Check: Docker vs native Node behavior differences.
Check: Any platform-specific code (macOS vs Linux)?
Files to check: infrastructure/docker/*, .github/workflows/*.
Report: Are runtime environments identical?"

Agent 4 - Database Parity:
"Investigate if [symptom] is caused by database differences.
Check: Are all migrations applied to production?
Check: Any new columns or tables missing?
Check: Any data-specific edge cases in production not in local?
Files to check: packages/database/prisma/schema.prisma, migrations/.
Report: Is database schema identical and migrations applied?"
```

Use the Task tool with `subagent_type=Explore` for each agent.
Run all agents in a **single message** (parallel execution).

## 5. Quick Parity Check

For Category B issues, also run these commands:

```bash
# Check dev/prod alignment
pnpm check-parity

# Check if code compiles like production
pnpm preflight:full
```

If either fails, that's likely the root cause.

## 6. Synthesize Results

Wait for all agents to complete, then summarize:

```markdown
## Investigation Results

### Symptom Category: {A/B/C/D}

### Playwright MCP Findings (if used)

- **Page state**: {loaded/error/blank}
- **Console errors**: {none/list of errors}
- **Network issues**: {none/failed requests}
- **Screenshot**: [captured]

### Parity Check Results (if Category B)

- `pnpm check-parity`: {PASS/FAIL}
- `pnpm preflight:full`: {PASS/FAIL}

### Hypothesis 1: {name}

**Verdict**: ✅ Clear / ⚠️ Suspicious / ❌ Root cause found
**Findings**: [agent summary]
**Key files**: [files examined]

### Hypothesis 2: {name}

**Verdict**: ✅ Clear / ⚠️ Suspicious / ❌ Root cause found
**Findings**: [agent summary]
**Key files**: [files examined]

### Hypothesis 3: {name}

**Verdict**: ✅ Clear / ⚠️ Suspicious / ❌ Root cause found
**Findings**: [agent summary]
**Key files**: [files examined]

{Additional hypotheses if Category B}

## Root Cause Identification

**Most likely root cause**: [hypothesis with ❌]
**Confidence**: High / Medium / Low
**Evidence**: [specific findings]

## Recommended Fix

{Specific steps to fix the issue}

## Environment for Fixing

- Quick iteration: `source .env.prod && pnpm dev`
- Pre-deploy check: `pnpm preflight:full`
- Production-like test: `pnpm preview`
```

## 7. Create or Update Issue

### If NEW symptom (no existing issue ID):

**Ask user:**

```
## Investigation Complete

Root cause identified: {root cause summary}

Would you like me to create an OPS issue to track this?
- Yes, create issue (recommended)
- No, just show findings
```

**If yes, create issue in `docs/ops/operations-log.md`:**

```markdown
### [OPS-XXX] {symptom as title}

| Field           | Value                   |
| --------------- | ----------------------- |
| **Status**      | Root Cause Found        |
| **Type**        | Bug                     |
| **Priority**    | {infer from severity}   |
| **Created**     | {today's date}          |
| **Sessions**    | 1                       |
| **Last Active** | {today's date and time} |

#### Description

{original symptom description}

#### Symptom Category

**Category {A/B/C/D}**: {category name}

#### Investigation Summary

| Hypothesis | Verdict  | Key Finding        |
| ---------- | -------- | ------------------ |
| {name 1}   | ✅/⚠️/❌ | {one-line finding} |
| {name 2}   | ✅/⚠️/❌ | {one-line finding} |
| {name 3}   | ✅/⚠️/❌ | {one-line finding} |

#### Root Cause

{detailed root cause from investigation}

#### Recommended Fix

{specific fix steps}

#### Fix Applied

TBD

#### Environment Strategy

| Mode                   | Command                        | Use When                     |
| ---------------------- | ------------------------------ | ---------------------------- |
| Local dev (default)    | `pnpm dev`                     | Feature development          |
| Production data        | `source .env.prod && pnpm dev` | Bug investigation, real data |
| Production-like Docker | `pnpm preview`                 | Pre-deploy verification      |
| Full parity check      | `pnpm preflight:full`          | Before any deployment        |

**Recommended for this issue**: Production data (for verification)

#### Local Verification Status

| Step           | Status     | Date | Notes |
| -------------- | ---------- | ---- | ----- |
| Prod data test | ⬜ Pending |      |       |
| Preflight      | ⬜ Pending |      |       |
| Docker test    | ⬜ Pending |      |       |

**Verified**: No

> ⚠️ Issue cannot be closed until all three steps are ✅

#### Session Log

- [{timestamp}] Issue created via /ops-investigate. Category: {A/B/C/D}. Root cause: {brief}

#### Files Involved

{list from investigation}

---
```

**Also update Quick Reference table** at top of ops log.

**Also create handoff file** `.ai/ops-{issue-id}-handoff.md`:

```markdown
# Handoff: [OPS-XXX] {title}

**Session**: 1
**Date**: {timestamp}
**Status**: Root Cause Found
**Created via**: /ops-investigate

## Investigation Summary

**Symptom**: {original symptom}
**Category**: {A/B/C/D} - {category name}
**Root Cause**: {identified root cause}

## Hypotheses Tested

| Hypothesis | Verdict  | Key Finding |
| ---------- | -------- | ----------- |
| {name 1}   | ✅/⚠️/❌ | {finding}   |
| {name 2}   | ✅/⚠️/❌ | {finding}   |
| {name 3}   | ✅/⚠️/❌ | {finding}   |

## Root Cause Details

{full details from investigation}

## Recommended Fix

{specific steps}

## Environment Strategy

- For fixing: `source .env.prod && pnpm dev`
- For testing: `pnpm preview`

## Local Verification Status

| Step           | Status     | Notes |
| -------------- | ---------- | ----- |
| Prod data test | ⬜ Pending |       |
| Preflight      | ⬜ Pending |       |
| Docker test    | ⬜ Pending |       |

**Verified**: No

## Next Steps

1. Implement the fix
2. Test with production data
3. Run preflight checks
4. Test in production Docker
5. Close issue

## Key Files

{files identified during investigation}
```

### If EXISTING issue ID provided:

Update the existing issue with investigation results:

1. Update status to "Root Cause Found"
2. Fill in "Root Cause" section
3. Add "Investigation Summary" section
4. Add "Recommended Fix" section
5. Update Session Log with investigation results
6. Update Files Involved
7. Update handoff file

## 8. Report to User

```
## Investigation Complete

### Issue: [OPS-XXX] {title}
**Status**: Root Cause Found
**Category**: {A/B/C/D}

### Root Cause
{identified root cause}

### Recommended Fix
{specific steps}

### Local Verification Required
Before this issue can be closed, you must verify:
1. ⬜ Test with production data (`source .env.prod && pnpm dev`)
2. ⬜ Run preflight checks (`pnpm preflight:full`)
3. ⬜ Test in production Docker (`pnpm preview`)

### Next Steps
To implement the fix: `/ops-continue OPS-XXX`

### Files to Modify
{key files from investigation}
```

## Common Root Causes Reference

From historical issues (OPS-001 through OPS-024):

| Rank | Root Cause                              | How to Detect                                     |
| ---- | --------------------------------------- | ------------------------------------------------- |
| 1    | TypeScript compiles locally, not Docker | `pnpm preflight:full` fails                       |
| 2    | Missing env var in production           | Compare `.env.prod` to Render dashboard           |
| 3    | Database migration not applied          | Check Prisma migrations vs prod DB                |
| 4    | Dependencies in devDeps                 | Check package.json for @prisma/client etc.        |
| 5    | Hardcoded data in component             | Search for `= []` or `useState([])` in components |
| 6    | Resolver not registered                 | Check GraphQL server.ts for resolver imports      |
| 7    | Field name mismatch                     | Compare Prisma schema to GraphQL schema           |

## Example Usage

```
/ops-investigate documents not appearing after import
→ Creates OPS-025 with full investigation

/ops-investigate OPS-024
→ Updates OPS-024 with investigation results

/ops-investigate login works locally but 401 in production
→ Creates issue with Category B investigation
```

## Important Rules

- **Always create/update an issue** - Investigations should be documented
- **Include verification checklist** - Required for closing
- **Set status to "Root Cause Found"** - Ready for fixing
- **Document all hypotheses** - Even cleared ones, for future reference
- **Recommend environment strategy** - Help next session start fast
